import { token } from "../lib/slices/tokensSlice";

export async function fetchEBirdObservations(species: string, accessToken: string) {
  // First, trigger the eBird ETL run for the species
  const runRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/etl/ebird/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      region_code: 'world',
      species: species,  // Use the animal name as species (common name)
      max_results: 100
    }),
  });
  if (!runRes.ok) return null;

  // Wait a bit for ETL to complete (in production, use polling or webhook)
  await new Promise(resolve => setTimeout(resolve, 5000));  // 5 seconds

  // Then fetch results
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/etl/ebird/results?species=${encodeURIComponent(species)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  return await res.json();
}
