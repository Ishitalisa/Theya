import "server-only";

import { XMLParser } from "fast-xml-parser";

import type { NewsArticle, NewsCategory } from "@/lib/types";

const SOURCES = [
  {
    key: "bbc-top",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/rss.xml?edition=int",
    category: "general",
  },
  {
    key: "bbc-world",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/world/rss.xml?edition=int",
    category: "world",
  },
  {
    key: "bbc-politics",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/politics/rss.xml",
    category: "politics",
  },
  {
    key: "bbc-business",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/business/rss.xml?edition=int",
    category: "business",
  },
  {
    key: "bbc-technology",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/technology/rss.xml?edition=int",
    category: "technology",
  },
  {
    key: "bbc-science",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml?edition=int",
    category: "science",
  },
  {
    key: "bbc-health",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/health/rss.xml?edition=int",
    category: "health",
  },
  {
    key: "bbc-sports",
    name: "BBC Sport",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/sport/rss.xml?edition=int",
    category: "sports",
  },
  {
    key: "bbc-entertainment",
    name: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    feed: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml?edition=int",
    category: "entertainment",
  },
  {
    key: "npr-world",
    name: "NPR",
    domains: ["npr.org"],
    feed: "https://feeds.npr.org/1004/rss.xml",
    category: "world",
  },
  {
    key: "npr-business",
    name: "NPR",
    domains: ["npr.org"],
    feed: "https://feeds.npr.org/1006/rss.xml",
    category: "business",
  },
  {
    key: "npr-technology",
    name: "NPR",
    domains: ["npr.org"],
    feed: "https://feeds.npr.org/1019/rss.xml",
    category: "technology",
  },
  {
    key: "npr-science",
    name: "NPR",
    domains: ["npr.org"],
    feed: "https://feeds.npr.org/1007/rss.xml",
    category: "science",
  },
  {
    key: "npr-health",
    name: "NPR",
    domains: ["npr.org"],
    feed: "https://feeds.npr.org/1128/rss.xml",
    category: "health",
  },
  {
    key: "coindesk",
    name: "CoinDesk",
    domains: ["coindesk.com"],
    feed: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    category: "crypto",
  },
  {
    key: "theblock",
    name: "The Block",
    domains: ["theblock.co"],
    feed: "https://www.theblock.co/rss.xml",
    category: "crypto",
  },
  {
    key: "decrypt",
    name: "Decrypt",
    domains: ["decrypt.co"],
    feed: "https://decrypt.co/feed",
    category: "crypto",
  },
  {
    key: "blockworks",
    name: "Blockworks",
    domains: ["blockworks.co", "blockworks.com"],
    feed: "https://blockworks.co/feed",
    category: "crypto",
  },
  {
    key: "defiant",
    name: "The Defiant",
    domains: ["thedefiant.io"],
    feed: "https://thedefiant.io/feed",
    category: "crypto",
  },
  {
    key: "bitcoinmagazine",
    name: "Bitcoin Magazine",
    domains: ["bitcoinmagazine.com"],
    feed: "https://bitcoinmagazine.com/.rss/full/",
    category: "crypto",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  domains: readonly string[];
  feed: string;
  category: NewsCategory;
}>;

const CATEGORY_ORDER: NewsCategory[] = [
  "general",
  "world",
  "politics",
  "business",
  "technology",
  "science",
  "health",
  "sports",
  "entertainment",
  "crypto",
];

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function belongsToSource(url: URL, source: (typeof SOURCES)[number]) {
  const hostname = url.hostname.toLowerCase();
  return source.domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record["#text"] ?? record["@_term"] ?? record["@_label"]);
  }
  return "";
}

function attribute(value: unknown, name: string) {
  if (!value || typeof value !== "object") return "";
  const item = Array.isArray(value) ? value[0] : value;
  return text((item as Record<string, unknown>)[name]);
}

function normalizeArticle(
  value: unknown,
  source: (typeof SOURCES)[number],
): NewsArticle | null {
  if (!value || typeof value !== "object") return null;
  const article = value as Record<string, unknown>;
  const link = httpsUrl(
    typeof article.link === "object"
      ? attribute(article.link, "@_href")
      : article.link,
  );
  const image = httpsUrl(
    attribute(article["media:content"], "@_url") ||
      attribute(article["media:thumbnail"], "@_url") ||
      attribute(article.enclosure, "@_url"),
  );
  const published = Date.parse(
    text(article.pubDate ?? article.published ?? article.updated),
  );
  const title = plainText(text(article.title));
  const description = plainText(
    text(article.description ?? article.summary ?? article["content:encoded"]),
  );
  if (
    !link ||
    !Number.isFinite(published) ||
    published > Date.now() + 10 * 60 * 1_000 ||
    !title ||
    !description
  ) {
    return null;
  }

  if (!belongsToSource(link, source)) return null;

  link.search = "";
  link.hash = "";
  return {
    title,
    description,
    link: link.toString(),
    source: source.name,
    sourceKey: source.key,
    pubDate: new Date(published).toISOString(),
    category: source.category,
    resolutionSources: [{ name: source.name, url: link.toString() }],
    image: image?.toString(),
    credibility: 1,
  };
}

export async function fetchNews(limit = 40): Promise<NewsArticle[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const feeds = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const response = await fetch(source.feed, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new Error(`${source.name} feed returned ${response.status}`);
      }
      const body = parser.parse(await response.text()) as {
        rss?: { channel?: { item?: unknown | unknown[] } };
        feed?: { entry?: unknown | unknown[] };
      };
      const raw = body.rss?.channel?.item ?? body.feed?.entry ?? [];
      return (Array.isArray(raw) ? raw : [raw])
        .map((article) => normalizeArticle(article, source))
        .filter((article): article is NewsArticle => article !== null);
    }),
  );

  const seen = new Set<string>();
  const articles = feeds
    .flatMap((feed) => (feed.status === "fulfilled" ? feed.value : []))
    .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
    .filter((article) => {
      const url = new URL(article.link);
      url.search = "";
      const key = url.toString().replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const buckets = new Map(
    CATEGORY_ORDER.map((category) => [
      category,
      articles.filter((article) => article.category === category),
    ]),
  );
  const balanced: NewsArticle[] = [];
  const cappedLimit = Math.max(1, Math.min(limit, 240));
  // ponytail: Round-robin is enough for ten fixed categories; use ranking only
  // when feed volume or personalization makes equal category share undesirable.
  while (balanced.length < cappedLimit) {
    let added = false;
    for (const category of CATEGORY_ORDER) {
      const article = buckets.get(category)?.shift();
      if (!article) continue;
      balanced.push(article);
      added = true;
      if (balanced.length === cappedLimit) break;
    }
    if (!added) break;
  }
  return balanced;
}
