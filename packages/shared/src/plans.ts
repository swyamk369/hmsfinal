import { MODULES, ModuleCode, ALL_MODULES } from './modules';

// Subscription plans. Prices are stored in MINOR units (paise / cents).
// e.g. priceInr 499900 = ₹4,999.00

export const PLAN_CODES = {
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

export interface PlanDef {
  code: PlanCode;
  name: string;
  priceInr: number; // minor units (paise); null-equivalent 0 = custom
  priceUsd: number; // minor units (cents)
  interval: 'MONTHLY';
  userLimit: number | null; // null = unlimited
  facilityLimit: number | null;
  bedLimit: number | null;
  modules: ModuleCode[];
}

const STARTER_MODULES: ModuleCode[] = [
  MODULES.ADMIN,
  MODULES.PATIENT,
  MODULES.OPD,
  MODULES.SCHEDULING,
  MODULES.BILLING,
];

const GROWTH_MODULES: ModuleCode[] = [...STARTER_MODULES, MODULES.LAB, MODULES.PHARMACY];

const PROFESSIONAL_MODULES: ModuleCode[] = [...GROWTH_MODULES, MODULES.INVENTORY, MODULES.IPD, MODULES.REPORTS];

export const PLAN_DEFS: PlanDef[] = [
  {
    code: PLAN_CODES.STARTER,
    name: 'Starter',
    priceInr: 499900,
    priceUsd: 5900,
    interval: 'MONTHLY',
    userLimit: 10,
    facilityLimit: 1,
    bedLimit: 0,
    modules: STARTER_MODULES,
  },
  {
    code: PLAN_CODES.GROWTH,
    name: 'Growth',
    priceInr: 1499900,
    priceUsd: 17900,
    interval: 'MONTHLY',
    userLimit: 50,
    facilityLimit: 2,
    bedLimit: 0,
    modules: GROWTH_MODULES,
  },
  {
    code: PLAN_CODES.PROFESSIONAL,
    name: 'Professional',
    priceInr: 3999900,
    priceUsd: 44900,
    interval: 'MONTHLY',
    userLimit: 200,
    facilityLimit: 5,
    bedLimit: 150,
    modules: PROFESSIONAL_MODULES,
  },
  {
    code: PLAN_CODES.ENTERPRISE,
    name: 'Enterprise',
    priceInr: 0, // custom / quote-led
    priceUsd: 0,
    interval: 'MONTHLY',
    userLimit: null,
    facilityLimit: null,
    bedLimit: null,
    modules: [...ALL_MODULES],
  },
];

export function modulesForPlan(code: PlanCode): ModuleCode[] {
  return PLAN_DEFS.find((p) => p.code === code)?.modules ?? STARTER_MODULES;
}
