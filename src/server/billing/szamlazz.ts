import { put } from "@vercel/blob";

type BuyerAddress = {
  postalCode: string;
  city: string;
  addressLine: string;
};

export type InvoiceBuyer = {
  name: string;
  email?: string | null;
  rawAddress: string;
};

export type ProviderInvoiceItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceHuf: number;
  netAmountHuf: number;
  vatRate: number;
  vatAmountHuf: number;
  grossAmountHuf: number;
};

export type SzamlazzRequest = {
  agentKey: string;
  eInvoice: boolean;
  externalId: string;
  issueDate: string;
  fulfillmentDate: string;
  dueDate: string;
  paymentMethodLabel: string;
  note?: string | null;
  buyer: InvoiceBuyer;
  items: ProviderInvoiceItem[];
};

export type SzamlazzResult = {
  invoiceNumber: string;
  providerInvoiceId: string;
  pdfUrl: string | null;
  netTotalHuf: number;
  grossTotalHuf: number;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function parseBuyerAddress(rawAddress: string): BuyerAddress {
  const cleaned = rawAddress.trim();
  const match = /^(\d{4})\s+([^,]+),\s*(.+)$/.exec(cleaned);

  if (!match) {
    throw new Error(
      "A Számlázz.hu számlához az ingatlannál ilyen cím kell: 1234 Város, Utca 1.",
    );
  }

  const postalCode = match[1];
  const city = match[2];
  const addressLine = match[3];
  if (!postalCode || !city || !addressLine) {
    throw new Error("A megadott cím nem elég részletes a számlázáshoz.");
  }

  return {
    postalCode,
    city: city.trim(),
    addressLine: addressLine.trim(),
  };
}

function extractHeader(headers: Headers, key: string) {
  return headers.get(key) ?? headers.get(key.toLowerCase()) ?? "";
}

function extractXmlTag(xml: string, tag: string) {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match?.[1]?.trim() ?? "";
}

async function uploadPdfToBlob(base64Pdf: string, invoiceNumber: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !base64Pdf) {
    return null;
  }

  const pdfBytes = Buffer.from(base64Pdf, "base64");
  const blob = await put(`invoices/${invoiceNumber}.pdf`, pdfBytes, {
    access: "public",
    contentType: "application/pdf",
  });

  return blob.url;
}

function buildInvoiceXml(request: SzamlazzRequest) {
  const buyerAddress = parseBuyerAddress(request.buyer.rawAddress);

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(request.agentKey)}</szamlaagentkulcs>
    <eszamla>${request.eInvoice ? "true" : "false"}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <szamlaKulsoAzon>${escapeXml(request.externalId)}</szamlaKulsoAzon>
  </beallitasok>
  <fejlec>
    <keltDatum>${request.issueDate}</keltDatum>
    <teljesitesDatum>${request.fulfillmentDate}</teljesitesDatum>
    <fizetesiHataridoDatum>${request.dueDate}</fizetesiHataridoDatum>
    <fizmod>${escapeXml(request.paymentMethodLabel)}</fizmod>
    <penznem>HUF</penznem>
    <szamlaNyelve>hu</szamlaNyelve>
    <megjegyzes>${escapeXml(request.note ?? "")}</megjegyzes>
    <rendelesSzam>${escapeXml(request.externalId)}</rendelesSzam>
  </fejlec>
  <elado />
  <vevo>
    <nev>${escapeXml(request.buyer.name)}</nev>
    <orszag>HU</orszag>
    <irsz>${escapeXml(buyerAddress.postalCode)}</irsz>
    <telepules>${escapeXml(buyerAddress.city)}</telepules>
    <cim>${escapeXml(buyerAddress.addressLine)}</cim>
    <email>${escapeXml(request.buyer.email ?? "")}</email>
    <sendEmail>${request.buyer.email ? "true" : "false"}</sendEmail>
    <adoalany>-1</adoalany>
  </vevo>
  <tetelek>
    ${request.items
      .map(
        (item) => `<tetel>
      <megnevezes>${escapeXml(item.description)}</megnevezes>
      <mennyiseg>${roundCurrency(item.quantity)}</mennyiseg>
      <mennyisegiEgyseg>${escapeXml(item.unit)}</mennyisegiEgyseg>
      <nettoEgysegar>${roundCurrency(item.unitPriceHuf)}</nettoEgysegar>
      <afakulcs>${item.vatRate}</afakulcs>
      <nettoErtek>${roundCurrency(item.netAmountHuf)}</nettoErtek>
      <afaErtek>${roundCurrency(item.vatAmountHuf)}</afaErtek>
      <bruttoErtek>${roundCurrency(item.grossAmountHuf)}</bruttoErtek>
      <megjegyzes></megjegyzes>
    </tetel>`,
      )
      .join("\n")}
  </tetelek>
</xmlszamla>`;
}

export async function createInvoiceWithSzamlazz(
  request: SzamlazzRequest,
): Promise<SzamlazzResult> {
  const xml = buildInvoiceXml(request);
  const formData = new FormData();
  formData.append("action-szamla_agent_xml", new Blob([xml], { type: "text/xml" }));

  const response = await fetch("https://www.szamlazz.hu/szamla/", {
    method: "POST",
    body: formData,
  });

  const responseText = await response.text();

  const headerError = extractHeader(response.headers, "szlahu_error");
  if (!response.ok || headerError) {
    throw new Error(
      decodeURIComponent(headerError || responseText || "Számlázz.hu request failed"),
    );
  }

  const successful = extractXmlTag(responseText, "sikeres");
  if (successful !== "true") {
    throw new Error(
      extractXmlTag(responseText, "hibauzenet") ||
        "Számlázz.hu invoice creation failed",
    );
  }

  const invoiceNumber =
    decodeURIComponent(extractHeader(response.headers, "szlahu_szamlaszam")) ||
    extractXmlTag(responseText, "szamlaszam");
  if (!invoiceNumber) {
    throw new Error("A Számlázz.hu nem adott vissza számlaszámot.");
  }

  const pdfBase64 = extractXmlTag(responseText, "pdf");
  const pdfUrl = await uploadPdfToBlob(pdfBase64, invoiceNumber);

  return {
    invoiceNumber,
    providerInvoiceId: request.externalId,
    pdfUrl,
    netTotalHuf: Number(extractXmlTag(responseText, "szamlanetto") || 0),
    grossTotalHuf: Number(extractXmlTag(responseText, "szamlabrutto") || 0),
  };
}
