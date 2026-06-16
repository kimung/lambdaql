export type NamingStrategy = (property: string) => string;

export const identityNaming: NamingStrategy = (p) => p;

export const snakeCaseNaming: NamingStrategy = (p) => p.replace(/([A-Z])/g, "_$1").toLowerCase();
