'use server';

import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { cache } from 'react';
import { formatArticle, getDateRange, validateArticle } from '../utils';

import { redis } from '../redis';
import { getWatchlistSymbolsByUserId } from './watchlist.actions';
import { auth } from '../better-auth/auth';
import { headers } from 'next/headers';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
  const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
    ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
    : { cache: 'no-store' };

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export { fetchJSON };

// export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
//   try {
//     const range = getDateRange(5);
//     const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
//     if (!token) throw new Error("FINNHUB API key is not configured");

//     const cleanSymbols = (symbols || [])
//       .map((s) => s?.trim().toUpperCase())
//       .filter(Boolean);

//     const maxArticles = 6;

//     //
//     // 1. COMPANY-SPECIFIC NEWS (round-robin)
//     //
//     if (cleanSymbols.length > 0) {
//       const perSymbol: Record<string, RawNewsArticle[]> = {};

//       await Promise.all(
//         cleanSymbols.map(async (sym) => {
//           try {
//             const url =
//               `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}` +
//               `&from=${range.from}&to=${range.to}&token=${token}`;

//             const raw = await fetchJSON<RawNewsArticle[]>(url, 2000);
//             perSymbol[sym] = (raw || []).filter(validateArticle);
//           } catch {
//             perSymbol[sym] = [];
//           }
//         })
//       );

//       const collected: MarketNewsArticle[] = [];

//       for (let r = 0; r < maxArticles; r++) {
//         for (const sym of cleanSymbols) {
//           const list = perSymbol[sym];
//           if (!list || list.length === 0) continue;
//           const next = list.shift();
//           if (!next || !validateArticle(next)) continue;
//           collected.push(formatArticle(next, true, sym, r));
//           if (collected.length >= maxArticles) break;
//         }
//         if (collected.length >= maxArticles) break;
//       }

//       if (collected.length > 0) {
//         collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
//         return collected.slice(0, maxArticles);
//       }
//     }

//     //
//     // 2. GENERAL MARKET NEWS
//     //
//     const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
//     const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

//     const seen = new Set<string>();
//     const unique: RawNewsArticle[] = [];

//     for (const a of general || []) {
//       if (!validateArticle(a)) continue;
//       const key = `${a.id}-${a.url}-${a.headline}`;
//       if (seen.has(key)) continue;
//       seen.add(key);
//       unique.push(a);
//       if (unique.length === 20) break;
//     }

//     if (unique.length > 0) {
//       return unique
//         .slice(0, maxArticles)
//         .map((a, i) => formatArticle(a, false, undefined, i));
//     }

//     //
//     // 3. NEWSDATA.IO FALLBACK
//     //
//     const ext = await getExternalMarketNews();
//     if (ext.length > 0) return ext.slice(0, maxArticles);

//     return [];
//   } catch (err) {
//     console.error("getNews error:", err);
//     return [];
//   }
// }

// export async function getExternalMarketNews(): Promise<MarketNewsArticle[]> {
//   const key = process.env.NEWSDATA_API_KEY;
//   if (!key) return [];

//   const url =
//     `https://newsdata.io/api/1/latest` +
//     `?apikey=${key}` +
//     `&q=stock%20market,finance,investment,shares` +
//     `&category=business` +
//     `&language=en&country=us`;

//   try {
//     const res = await fetch(url, { cache: "no-store" });
//     const data = await res.json();

//     if (!data.results) return [];

//     return data.results
//       .slice(0, 10)
//       .map((a: any, idx: number) => ({
//         id: String(a.article_id || a.link || idx),
//         source: a.source_id || "external",
//         headline: a.title || "",
//         summary: a.description || "",
//         url: a.link,
//         datetime: new Date(a.pubDate).getTime(),
//         category: "external",
//       }));
//   } catch {
//     return [];
//   }
// }



export const searchStocks = cache(async (query?: string, userId?: string): Promise<StockWithWatchlistStatus[]> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const realUserId = session?.user?.id;

  // Ignore the userId coming from client
  const safeUserId = realUserId ?? undefined;
  
  try {
    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
      console.error("Error in stock search:", new Error("FINNHUB API key is not configured"));
      return [];
    }

    const trimmed = typeof query === "string" ? query.trim() : "";
    let results: FinnhubSearchResult[] = [];

    // 🧩 Fetch either popular or searched stocks
    if (!trimmed) {
      // Fetch top 10 popular symbols' profiles
      const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
      const profiles = await Promise.all(
        top.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
            const profile = await fetchJSON<any>(url, 3600);
            return { sym, profile };
          } catch (e) {
            console.error("Error fetching profile2 for", sym, e);
            return { sym, profile: null };
          }
        })
      );

      results = profiles
        .map(({ sym, profile }) => {
          const symbol = sym.toUpperCase();
          const name: string | undefined = profile?.name || profile?.ticker;
          const exchange: string | undefined = profile?.exchange;
          if (!name) return undefined;
          const r: FinnhubSearchResult = {
            symbol,
            description: name,
            displaySymbol: symbol,
            type: "Common Stock",
          };
          (r as any).__exchange = exchange;
          return r;
        })
        .filter(Boolean) as FinnhubSearchResult[];
    } else {
      const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
      const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
      results = Array.isArray(data?.result) ? data.result : [];
    }

    // ✅ Fetch the user's watchlist symbols (if logged in)
    const watchlistSymbols = safeUserId
    ? await getWatchlistSymbolsByUserId(safeUserId)
    : [];

    // ✅ Map results and mark isInWatchlist
    const mapped: StockWithWatchlistStatus[] = results
      .map((r) => {
        const upper = (r.symbol || "").toUpperCase();
        const name = r.description || upper;
        const exchangeFromDisplay = (r.displaySymbol as string | undefined) || undefined;
        const exchangeFromProfile = (r as any).__exchange as string | undefined;
        const exchange = exchangeFromDisplay || exchangeFromProfile || "US";
        const type = r.type || "Stock";

        const item: StockWithWatchlistStatus = {
          symbol: upper,
          name,
          exchange,
          type,
          isInWatchlist: watchlistSymbols.some((sym) => sym.s === upper),
        };
        return item;
      })
      .slice(0, 15);

    return mapped;
  } catch (err) {
    console.error("Error in stock search:", err);
    return [];
  }
});

export async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) throw new Error("FINNHUB API key not configured");
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    const data = await fetchJSON<{ c: number }>(url, 10);
    return typeof data.c === "number" ? data.c : null; // c = current price
  } catch (err) {
    console.error("getCurrentPrice error:", err);
    return null;
  }
}

export async function fetchCompanyProfile(
  symbol: string
): Promise<CompanyProfile | null> {
  try {
    const token =
      process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) throw new Error("FINNHUB API key not configured");

    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(
      symbol
    )}&token=${token}`;

    const data = await fetchJSON<CompanyProfile>(url, 10);
    return data;
  } catch (err) {
    console.error("fetchCompanyProfile error:", err);
    return null;
  }
}

const TTL = 86400;

export async function getCompanyProfile(
  symbol: string
): Promise<CompanyProfile | null> {
  const key = `profile:${symbol}`;

  const cached = await redis.get<CompanyProfile>(key);
  if (cached) return cached;

  const fresh = await fetchCompanyProfile(symbol);
  if (fresh) {
    await redis.set(key, fresh, { ex: TTL });
  }

  return fresh;
}

