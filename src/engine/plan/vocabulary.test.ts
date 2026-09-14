import { describe, expect, it } from "vitest";
import { CUSTOMER_NOUNS, PRODUCT_NOUNS, customerNoun, productNoun } from "./vocabulary";

describe("product nouns", () => {
  it("gives every offered type all three words", () => {
    for (const n of PRODUCT_NOUNS) {
      expect(n.many, `${n.many} plural`).toBeTruthy();
      expect(n.one, `${n.many} singular`).toBeTruthy();
      expect(n.head, `${n.many} header`).toBeTruthy();
    }
  });

  /**
   * The test the old list failed. Every value has to survive all six shapes the Sales screen uses it in,
   * which is what "+ Produce" and "Open a produce to describe it" could not do.
   */
  it("reads correctly in all six grammatical shapes", () => {
    for (const n of PRODUCT_NOUNS) {
      const shapes = [
        n.many,                                  // tab
        n.head.toUpperCase(),                    // column header
        `Add your first ${n.one}`,               // empty state
        `10 ${n.many.toLowerCase()}`,            // counted
        `All ${n.many.toLowerCase()}`,           // scope chip
        `Open a ${n.one} to describe it`,        // mid-sentence with an article
      ];
      for (const s of shapes) {
        expect(s, `${n.many}: "${s}"`).not.toMatch(/\s{2,}|\bundefined\b/);
        expect(s.trim().length, `${n.many}: "${s}"`).toBeGreaterThan(0);
      }
      // A column header has to fit a dense grid; "INTELLECTUAL PROPERTY" is what this rules out.
      expect(n.head.length, `${n.many} header width`).toBeLessThanOrEqual(12);
    }
  });

  it("has no duplicate values", () => {
    const seen = PRODUCT_NOUNS.map((n) => n.many.toLowerCase());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("falls back to line where a type has no natural singular", () => {
    expect(productNoun("Products and services").one).toBe("line");
    expect(productNoun("Livestock").one).toBe("line");
    expect(productNoun("Goods").one).toBe("line");
    // …and not anywhere else.
    expect(productNoun("Services").one).toBe("service");
    expect(productNoun("Treatments").one).toBe("treatment");
  });

  it("names the line, never one sale — the mistake Jobs made", () => {
    // A row is a line with a units count beside it: "Driveways", 30. Any noun here has to be the word for
    // the LINE, because the units column already counts the sales.
    expect(PRODUCT_NOUNS.map((n) => n.many)).not.toContain("Jobs");
  });

  it("carries a retired value to its replacement rather than blanking the field", () => {
    expect(productNoun("Access").many).toBe("Memberships");
    expect(productNoun("Applications").many).toBe("Subscriptions");
    expect(productNoun("Intellectual Property").many).toBe("Licences");
    expect(productNoun("Produce").many).toBe("Crops");
    expect(productNoun("Jobs").many).toBe("Services");
  });

  it("lands on Products for missing, unknown or malformed", () => {
    expect(productNoun(null).many).toBe("Products");
    expect(productNoun(undefined).many).toBe("Products");
    expect(productNoun("").many).toBe("Products");
    expect(productNoun("   ").many).toBe("Products");
    expect(productNoun("Widgets").many).toBe("Products");
    expect(productNoun("  services  ").many).toBe("Services");
  });

  it("keeps British spelling", () => {
    expect(PRODUCT_NOUNS.map((n) => n.many)).toContain("Programmes");
    expect(PRODUCT_NOUNS.map((n) => n.many)).toContain("Licences");
    expect(PRODUCT_NOUNS.map((n) => n.many)).not.toContain("Programs");
    expect(PRODUCT_NOUNS.map((n) => n.many)).not.toContain("Licenses");
  });
});

describe("customer nouns", () => {
  it("pluralises every offered type by agreement, not by guesswork", () => {
    for (const c of CUSTOMER_NOUNS) {
      const n = customerNoun(c);
      expect(n.many).toBe(`${c}s`);
      expect(n.one).toBe(c.toLowerCase());
      expect(n.head).toBe(c);
    }
  });

  it("reads correctly in a sentence", () => {
    expect(`Name the ${customerNoun("Patient").one}`).toBe("Name the patient");
    expect(`10 ${customerNoun("Subscriber").many.toLowerCase()}`).toBe("10 subscribers");
  });

  it("lands on Customer for missing or unknown", () => {
    expect(customerNoun(null).many).toBe("Customers");
    expect(customerNoun("Shopper").many).toBe("Customers");
    expect(customerNoun("  client ").many).toBe("Clients");
  });
});
