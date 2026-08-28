import { DOMParser as XmlDomParser, onErrorStopParsing } from "@xmldom/xmldom";

/**
 * Parse BPMN XML into a DOM document in any runtime.
 *
 * `validateLayout` needs a read-only DOM (`getElementsByTagName` /
 * `getAttribute`) over the rendered layout XML. Browsers provide `DOMParser`
 * natively; Node does not, and the skill's CLI runs headless. `@xmldom/xmldom`
 * is a pure-JS implementation of the subset used here, so it bundles cleanly
 * into the skill's single-file build — no jsdom, no native module.
 *
 * Returns `null` when the XML is not well-formed, which callers surface as
 * `LAYOUT_XML_PARSE_ERROR`.
 */
export function parseXmlDocument(xml: string): Document | null {
  const native = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (native !== undefined) {
    const doc = new native().parseFromString(xml, "application/xml");
    return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
  }

  try {
    // `onErrorStopParsing` promotes recoverable errors to throws, so malformed
    // input fails loudly instead of yielding a silently truncated document.
    const doc = new XmlDomParser({ onError: onErrorStopParsing }).parseFromString(
      xml,
      "application/xml",
    );
    return doc as unknown as Document;
  } catch {
    return null;
  }
}
