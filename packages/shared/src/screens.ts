// Frontend screen catalog — maps extracted design references to routes/components.
// Source: extracted-frontend-screens/README_FOR_CLAUDE.md

export interface ScreenRef {
  ref: string;
  target: string;
  pack: string;
  status: 'built' | 'planned';
}

export const SCREEN_CATALOG: ScreenRef[] = [
  { ref: 'global_login_hms_portal', target: '/login', pack: 'pack-3', status: 'built' },
  { ref: 'access_suspended_hms_portal', target: '/tenant-suspended', pack: 'pack-3', status: 'built' },
  { ref: 'global_search_results', target: 'global search', pack: 'pack-3', status: 'planned' },
  { ref: 'platform_super_admin_dashboard', target: '/platform', pack: 'pack-3', status: 'built' },
  { ref: 'system_audit_logs_hms_portal', target: '/platform/audit', pack: 'pack-5', status: 'built' },
  { ref: 'patient_directory_hms_portal', target: '/patients', pack: 'pack-3', status: 'planned' },
  { ref: 'opd_queue_board_hms_portal', target: '/opd', pack: 'pack-3', status: 'planned' },
  { ref: 'doctor_dashboard_hms_portal', target: '/doctor', pack: 'pack-3', status: 'planned' },
  { ref: 'billing_dashboard_hms_portal', target: '/finance', pack: 'pack-4', status: 'built' },
  { ref: 'lab_technician_dashboard_hms_portal', target: '/lab', pack: 'pack-4', status: 'planned' },
  { ref: 'pharmacy_dashboard_hms_portal', target: '/pharmacy', pack: 'pack-4', status: 'planned' },
  { ref: 'inventory_management_hms_portal', target: '/inventory', pack: 'pack-4', status: 'planned' },
  { ref: 'insurance_claims_dashboard_hms_portal', target: '/insurance', pack: 'pack-4', status: 'planned' },
  { ref: 'ipd_bed_management_hms_portal', target: '/ipd', pack: 'pack-3', status: 'planned' },
];
