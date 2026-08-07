import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import CountryDetail from "./CountryDetail";

const data = backbone as WorldBackbone;

export function generateStaticParams() {
  return data.countries.map((c) => ({ iso3: c.iso3.toLowerCase() }));
}

export default function Page({
  params,
}: {
  params: Promise<{ iso3: string }>;
}) {
  return <CountryDetail params={params} />;
}
