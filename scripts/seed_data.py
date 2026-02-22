"""Seed test data for development."""
import sys
import os
import bcrypt
from datetime import date, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db, Property, MeterReading, Payment, MaintenanceLog, Todo, TariffGroup, Tariff


def seed():
    """Create test properties and sample data."""
    app = create_app('development')

    with app.app_context():
        # Check if data already exists
        if Property.query.count() > 0:
            print("Data already exists. Skipping seed.")
            return

        lakas_group = TariffGroup.query.filter_by(name='Lakas').first()
        uzleti_group = TariffGroup.query.filter_by(name='Uzleti').first()

        if not lakas_group or not uzleti_group:
            print("Error: Tariff groups not found. Run app first to create seed tariffs.")
            return

        # Create 10 test properties
        properties = []
        for i in range(1, 11):
            pin = f"{1000 + i}"
            pin_hash = bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            prop_type = 'uzlet' if i >= 9 else 'lakas'
            group = uzleti_group if prop_type == 'uzlet' else lakas_group

            prop = Property(
                name=f"{i}. {'Uzlet' if prop_type == 'uzlet' else 'Lakas'}",
                property_type=prop_type,
                pin_hash=pin_hash,
                tariff_group_id=group.id,
                contact_name=f"Teszt Berlo {i}",
                contact_phone=f"+36 30 {random.randint(100, 999)} {random.randint(1000, 9999)}",
                address=f"Teszt utca {i}.",
                purchase_price=random.randint(15, 35) * 1000000,
                monthly_rent=random.randint(80, 200) * 1000,
            )
            properties.append(prop)

        db.session.add_all(properties)
        db.session.commit()
        print(f"Created {len(properties)} test properties.")
        print("PIN kodok: 1001, 1002, ... 1010")

        # Create sample meter readings (last 6 months)
        for prop in properties:
            villany_tariff = Tariff.query.filter_by(
                tariff_group_id=prop.tariff_group_id, utility_type='villany'
            ).first()
            viz_tariff = Tariff.query.filter_by(
                tariff_group_id=prop.tariff_group_id, utility_type='viz'
            ).first()
            csatorna_tariff = Tariff.query.filter_by(
                tariff_group_id=prop.tariff_group_id, utility_type='csatorna'
            ).first()

            villany_value = random.randint(1000, 5000)
            viz_value = random.randint(100, 500)

            for month_offset in range(6, 0, -1):
                reading_date = date.today() - timedelta(days=month_offset * 30)

                # Villany
                v_consumption = random.randint(100, 400)
                villany_value += v_consumption
                v_cost = v_consumption * villany_tariff.rate_huf if villany_tariff else 0

                reading_v = MeterReading(
                    property_id=prop.id,
                    utility_type='villany',
                    value=villany_value,
                    prev_value=villany_value - v_consumption,
                    consumption=v_consumption,
                    tariff_id=villany_tariff.id if villany_tariff else None,
                    cost_huf=v_cost,
                    reading_date=reading_date,
                )
                db.session.add(reading_v)

                # Viz
                w_consumption = round(random.uniform(2, 15), 1)
                viz_value += w_consumption
                w_cost = w_consumption * viz_tariff.rate_huf if viz_tariff else 0

                reading_w = MeterReading(
                    property_id=prop.id,
                    utility_type='viz',
                    value=round(viz_value, 1),
                    prev_value=round(viz_value - w_consumption, 1),
                    consumption=w_consumption,
                    tariff_id=viz_tariff.id if viz_tariff else None,
                    cost_huf=w_cost,
                    reading_date=reading_date,
                )
                db.session.add(reading_w)

                # Csatorna (auto from water)
                c_cost = w_consumption * csatorna_tariff.rate_huf if csatorna_tariff else 0
                reading_c = MeterReading(
                    property_id=prop.id,
                    utility_type='csatorna',
                    value=round(viz_value, 1),
                    prev_value=round(viz_value - w_consumption, 1),
                    consumption=w_consumption,
                    tariff_id=csatorna_tariff.id if csatorna_tariff else None,
                    cost_huf=c_cost,
                    reading_date=reading_date,
                    notes='Automatikusan szamolva viz alapjan',
                )
                db.session.add(reading_c)

            # Sample payments
            for month_offset in range(6, 0, -1):
                payment = Payment(
                    property_id=prop.id,
                    amount_huf=prop.monthly_rent + random.randint(-5000, 5000),
                    payment_date=date.today() - timedelta(days=month_offset * 30 - 5),
                    payment_method=random.choice(['keszpenz', 'atutalas']),
                    notes=f"Havi berlet + rezsi",
                )
                db.session.add(payment)

        db.session.commit()
        print("Created sample meter readings and payments (6 months).")

        # Sample maintenance logs
        maintenance_items = [
            ("Csaptelep csere - konyha", "vizszereles", 15000),
            ("Villanykapcsolo csere", "villanyszereles", 5000),
            ("Festes - nappali", "festes", 45000),
            ("Zarcsere - bejarat", "lakatossag", 12000),
            ("Altalanos takaritas", "takaritas", 8000),
        ]
        for desc, cat, cost in maintenance_items:
            log = MaintenanceLog(
                property_id=random.choice(properties).id,
                description=desc,
                category=cat,
                cost_huf=cost,
                performed_by="Mester Janos",
                performed_date=date.today() - timedelta(days=random.randint(1, 90)),
            )
            db.session.add(log)

        # Sample todos
        todo_items = [
            ("Meroora csere - 3. Lakas", "high"),
            ("Kertrendezest beszervezni tavasszal", "medium"),
            ("Biztositas megujitas", "high"),
            ("Festos ajanlat kerese", "low"),
        ]
        for title, priority in todo_items:
            todo = Todo(
                title=title,
                priority=priority,
                property_id=random.choice(properties).id if random.random() > 0.3 else None,
                due_date=date.today() + timedelta(days=random.randint(7, 60)),
            )
            db.session.add(todo)

        db.session.commit()
        print("Created sample maintenance logs and todos.")
        print("\nSeed complete! The app is ready for testing.")


if __name__ == '__main__':
    seed()
