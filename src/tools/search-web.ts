const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

interface SearchWebInput {
  query: string;
  count?: number;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function handleSearchWeb(input: SearchWebInput): Promise<string> {
  if (!BRAVE_API_KEY) {
    return JSON.stringify({
      success: false,
      message: "Web search is not configured. Brave Search API key is missing.",
    });
  }

  const count = input.count || 5;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.query + " recipe")}&count=${count}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": BRAVE_API_KEY,
    },
  });

  if (!response.ok) {
    return JSON.stringify({
      success: false,
      message: `Search failed: ${response.statusText}`,
    });
  }

  const data = (await response.json()) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  };
  const results: BraveSearchResult[] = (data.web?.results || [])
    .slice(0, count)
    .map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));

  return JSON.stringify({
    success: true,
    query: input.query,
    results,
    message: `Found ${results.length} recipe results for "${input.query}".`,
  });
}
