export const formatDocId = (name: string) => {
  return name.trim().toUpperCase().replace(/\s+/g, "_");
};
