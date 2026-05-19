type JsonLdGraph = Record<string, unknown>;

export function JsonLd({ data }: { data: JsonLdGraph | JsonLdGraph[] }) {
  const graphs = Array.isArray(data) ? data : [data];
  return (
    <>
      {graphs.map((graph, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
      ))}
    </>
  );
}
