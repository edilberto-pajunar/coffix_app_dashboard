export function renderEmailTemplate(
  content: string,
  variables: Record<string, string | number>
): string {
  return content.replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
    variables[key] !== undefined ? String(variables[key]) : `{{ ${key} }}`
  );
}
