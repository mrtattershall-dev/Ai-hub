async function loadData() {
  const files = ["levels", "enemies", "upgrades", "unlocks", "dialogue", "items"];
  const entries = await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw new Error(`Failed to load data/${name}.json (${res.status})`);
      return [name, await res.json()];
    })
  );
  return Object.fromEntries(entries);
}