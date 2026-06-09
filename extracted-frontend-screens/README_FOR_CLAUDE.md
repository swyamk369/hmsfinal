# Frontend Screen References For Claude

Claude does not accept `.zip` uploads directly. Use these extracted folders instead.

Each screen folder contains:

- `screen.png` — visual reference Claude can read as an image.
- `code.html` — generated HTML reference Claude can read as text.
- Some packs also include `clinical_operations_system/DESIGN.md`.

Important implementation rule:

- Use these files as design references only.
- Do not blindly copy generated HTML.
- Rebuild the app as clean Next.js App Router + TypeScript + Tailwind components.
- Follow `PROJECT_IMPLEMENTATION_PLAN.md` as the engineering source of truth.
- Firebase Auth only. No dev auth, no fake headers, no quick login.

## How To Reference In Claude

If Claude is working in this project folder, reference files by path using `@`.

Examples:

```text
Read @extracted-frontend-screens/README_FOR_CLAUDE.md first.
Use @PROJECT_IMPLEMENTATION_PLAN.md as the build plan.
For the login screen, inspect:
@extracted-frontend-screens/pack-3/stitch_mediflow_pro_hospital_erp/global_login_hms_portal/screen.png
@extracted-frontend-screens/pack-3/stitch_mediflow_pro_hospital_erp/global_login_hms_portal/code.html
```

For each phase, give Claude only the relevant screen folders instead of all screens at once.

## Pack 3 — Core Clinical And Access Screens

- `global_login_hms_portal` -> `/login`
- `access_suspended_hms_portal` -> `/tenant-suspended`
- `global_search_results` -> global search
- `platform_super_admin_dashboard` -> `/platform`
- `patient_directory_hms_portal` -> `/patients`
- `register_new_patient_hms_portal` -> patient registration
- `opd_queue_board_hms_portal` -> `/opd`
- `opd_appointments_hms_portal` -> `/opd/appointments`
- `doctor_dashboard_hms_portal` -> `/doctor`
- `active_consultation_hms_portal` -> `/doctor/consult/[encounterId]`
- `prescription_builder_hms_portal` -> prescription tab/component
- `prescription_print_view` -> prescription print layout
- `nurse_dashboard_hms_portal` -> `/nursing`
- `medication_administration_chart_mar` -> MAR/nursing medication chart
- `ipd_bed_management_hms_portal` -> `/ipd`
- `patient_admission_hms_portal` -> `/ipd/admit`

## Pack 4 — Billing, Lab, Pharmacy, Inventory, Insurance

- `billing_dashboard_hms_portal` -> `/billing`
- `create_new_bill_hms_portal` -> `/billing/new`
- `collect_payment_hms_portal` -> collect payment modal/screen
- `invoice_print_view_hms_portal` -> `/billing/[id]/invoice`
- `lab_technician_dashboard_hms_portal` -> `/lab`
- `sample_collection_queue_hms_portal` -> lab sample queue
- `result_entry_complete_blood_count_hms_portal` -> lab result entry
- `lab_report_print_view_complete_blood_count` -> `/lab/reports/[id]`
- `pharmacy_dashboard_hms_portal` -> `/pharmacy`
- `prescription_dispensing_hms_portal` -> `/pharmacy/dispense/[id]`
- `inventory_management_hms_portal` -> `/inventory`
- `stock_adjustment_grn_hms_portal` -> inventory stock adjustment / GRN
- `insurance_claims_dashboard_hms_portal` -> `/insurance`
- `new_claim_submission_hms_portal` -> create claim modal/screen
- `claim_detail_adjudication_hms_portal` -> `/insurance/claims/[id]`
- `insurance_payer_directory_hms_portal` -> `/admin/insurance` or insurance payer directory

## Pack 5 — Admin, Reports, Patient Portal, Procurement

- `platform_super_admin_dashboard` -> alternate `/platform` reference
- `facility_ward_configuration_hms_portal` -> `/admin/wards`
- `user_roles_permissions_hms_portal` -> `/admin/roles`
- `system_audit_logs_hms_portal` -> `/platform/audit` or audit components
- `executive_analytics_dashboard_hms_portal` -> `/manager` or executive reports
- `staff_productivity_resource_utilization` -> reports/staff productivity
- `revenue_cycle_performance_analytics` -> `/reports/financial`
- `clinical_quality_outcomes_report` -> `/reports/clinical`
- `procurement_dashboard_hms_portal` -> inventory procurement dashboard
- `create_purchase_order_hms_portal` -> `/inventory/purchases`
- `receive_goods_grn_hms_portal` -> GRN/stock-in
- `vendor_directory_hms_portal` -> `/inventory/suppliers`
- `patient_portal_dashboard_hms_portal` -> future patient portal
- `my_medical_records_patient_portal` -> future patient portal records
- `book_an_appointment_patient_portal` -> future patient appointment booking
- `billing_payments_patient_portal` -> future patient billing portal

## Pack 6 — Future Advanced Modules

These are future modules unless explicitly added to the current app plan.

- `maintenance_operations_dashboard` -> future maintenance/facilities module
- `maintenance_schedule_dispatch` -> future maintenance scheduling
- `facility_service_requests` -> future facility service requests
- `equipment_inventory_asset_tracking` -> future biomedical/equipment assets
- `ambulance_inbound_tracker_hms_portal` -> future ambulance module
- `emergency_command_center_hms_portal` -> future emergency command center
- `trauma_bay_status_hms_portal` -> future emergency/trauma
- `rapid_triage_assessment_hms_portal` -> future triage
- `dietary_nutrition_management_hms_portal` -> future dietary/nutrition
- `telehealth_virtual_consultation_hms_portal` -> future telehealth
- `telehealth_appointment_queue_hms_portal` -> future telehealth queue
- `patient_feedback_survey_patient_portal` -> future patient feedback

## Recommended Claude Workflow

Use one phase at a time:

```text
Implement only frontend Phase X.
Read @PROJECT_IMPLEMENTATION_PLAN.md.
Read @extracted-frontend-screens/README_FOR_CLAUDE.md.
Inspect these screen references:
@path/to/screen.png
@path/to/code.html

Rebuild the UI as clean Next.js + TypeScript + Tailwind.
Do not copy generated HTML blindly.
Do not use dev auth.
Run the frontend build.
Report files changed, routes completed, screens used, and known gaps.
```

