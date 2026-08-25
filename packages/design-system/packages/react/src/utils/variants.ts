type VariantConfig = Record<string, Record<string, string>>;

export function variantClasses(
  base: string,
  variants: VariantConfig,
  props: Record<string, string | undefined>,
): string {
  const parts = [base];
  for (const [key, map] of Object.entries(variants)) {
    const value = props[key];
    if (value && map[value]) {
      parts.push(map[value]);
    }
  }
  return parts.join(' ');
}
