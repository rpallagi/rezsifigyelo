"""MQTT background client for receiving smart meter data.

Runs as a daemon thread inside the Flask process.
Uses paho-mqtt to subscribe to topics configured in SmartMeterDevice rows.
"""
import threading
import json
import logging

logger = logging.getLogger('mqtt_client')


class MQTTSmartMeterClient:
    """MQTT client that subscribes to smart meter topics and processes messages."""

    def __init__(self, app):
        self.app = app
        self.client = None
        self._thread = None
        self._connected = False

    @property
    def is_connected(self):
        return self._connected

    def start(self):
        """Start MQTT client in a background daemon thread."""
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            logger.error("paho-mqtt not installed. Run: pip install paho-mqtt")
            return

        broker = self.app.config.get('MQTT_BROKER_HOST', 'localhost')
        port = self.app.config.get('MQTT_BROKER_PORT', 1883)
        username = self.app.config.get('MQTT_USERNAME')
        password = self.app.config.get('MQTT_PASSWORD')

        self.client = mqtt.Client(
            client_id='rezsi-figyelo-smart-meter',
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        if username:
            self.client.username_pw_set(username, password or '')

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        # Run in daemon thread so it dies with the main process
        self._thread = threading.Thread(
            target=self._run, args=(broker, port),
            daemon=True, name='mqtt-smart-meter'
        )
        self._thread.start()
        logger.info(f"MQTT client thread started, connecting to {broker}:{port}")

    def _run(self, broker, port):
        """Connect with automatic reconnect."""
        try:
            self.client.connect(broker, port, keepalive=60)
            self.client.loop_forever(retry_first_connection=True)
        except Exception as e:
            logger.error(f"MQTT connection error: {e}")

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        """Subscribe to all configured MQTT topics from SmartMeterDevice rows."""
        if reason_code == 0:
            self._connected = True
            logger.info("MQTT connected successfully")
            with self.app.app_context():
                from models import SmartMeterDevice
                devices = SmartMeterDevice.query.filter_by(
                    source='mqtt', is_active=True
                ).all()
                for dev in devices:
                    if dev.mqtt_topic:
                        client.subscribe(dev.mqtt_topic)
                        logger.info(f"Subscribed to {dev.mqtt_topic}")

                # Subscribe to wildcard prefixes (comma-separated)
                wildcard = self.app.config.get('MQTT_TOPIC_PREFIX', 'rezsi/#')
                if wildcard:
                    for topic in wildcard.split(','):
                        topic = topic.strip()
                        if topic:
                            client.subscribe(topic)
                            logger.info(f"Subscribed to wildcard: {topic}")
        else:
            self._connected = False
            logger.error(f"MQTT connect failed with rc={reason_code}")

    def _on_message(self, client, userdata, msg):
        """Process incoming MQTT message."""
        with self.app.app_context():
            try:
                topic = msg.topic
                payload_str = msg.payload.decode('utf-8')

                try:
                    payload = json.loads(payload_str)
                except json.JSONDecodeError:
                    # Try as plain number
                    try:
                        payload = float(payload_str)
                    except ValueError:
                        logger.warning(f"MQTT: unparseable payload on {topic}: {payload_str[:200]}")
                        return

                # Find device by mqtt_topic
                from models import SmartMeterDevice
                device = SmartMeterDevice.query.filter_by(
                    mqtt_topic=topic, source='mqtt', is_active=True
                ).first()

                if not device:
                    # Try matching by device_id extracted from topic
                    # Convention: topic = "rezsi/{device_id}" or "{prefix}/{device_id}"
                    parts = topic.rsplit('/', 1)
                    if len(parts) == 2:
                        device = SmartMeterDevice.query.filter_by(
                            device_id=parts[1], source='mqtt', is_active=True
                        ).first()

                if not device:
                    logger.debug(f"MQTT: no device mapping for topic {topic}")
                    return

                from services.smart_meter import process_smart_meter_reading
                result = process_smart_meter_reading(
                    device_id=device.device_id,
                    raw_value=payload,
                    source='mqtt',
                    raw_payload=payload_str,
                )
                if result['status'] == 'ok':
                    logger.info(f"MQTT reading processed: {device.device_id} -> {result}")
                elif result['status'] == 'error':
                    logger.warning(f"MQTT reading error: {device.device_id} -> {result}")

            except Exception as e:
                logger.error(f"MQTT message processing error: {e}", exc_info=True)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        """Handle disconnection."""
        self._connected = False
        logger.warning(f"MQTT disconnected (rc={reason_code}), will auto-reconnect")

    def refresh_subscriptions(self):
        """Called when admin adds/removes/edits a SmartMeterDevice with source='mqtt'."""
        if self.client and self._connected:
            self._on_connect(self.client, None, None, 0)
