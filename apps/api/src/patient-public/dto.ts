import { IsReason } from '../common/validation';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CONSULT_TYPES = ['IN_PERSON', 'TELEHEALTH', 'BOTH'] as const;
export const APPROVAL_MODES = ['AUTOMATIC', 'MANUAL', 'HYBRID'] as const;
export const OVERRIDE_TYPES = ['UNAVAILABLE', 'EXTRA_AVAILABLE', 'BLOCKED'] as const;

// ── Patient portal settings ─────────────────────────────────────
export class PortalSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() onlineBookingEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(160) clinicDisplayName?: string;
  @IsOptional() @IsString() @MaxLength(500) clinicLogoUrl?: string;
  @IsOptional() @IsString() @MaxLength(20) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(40) publicContactNumber?: string;
  @IsOptional() @IsString() @MaxLength(160) publicEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(4000) bookingTerms?: string;
  @IsOptional() @IsString() @MaxLength(4000) cancellationPolicy?: string;
  @IsOptional() @IsString() @MaxLength(4000) privacyNotice?: string;
  @IsOptional() @IsBoolean() allowNewPatientBookings?: boolean;
  @IsOptional() @IsBoolean() allowExistingPatientBookings?: boolean;
  @IsOptional() @IsIn(APPROVAL_MODES) bookingApprovalMode?: (typeof APPROVAL_MODES)[number];
  @IsOptional() @IsInt() @Min(0) @Max(720) minimumBookingNoticeHours?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) maximumBookingAdvanceDays?: number;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
}

// ── Public hospital profile ─────────────────────────────────────
export class HospitalProfileDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) hospitalDisplayName?: string;
  @IsOptional() @IsBoolean() bookingEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) coverImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(120) country?: string;
  @IsOptional() @IsString() @MaxLength(20) postcode?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) facilities?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) services?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) consultationTypes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) insuranceAccepted?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
}

// ── Public doctor profile ───────────────────────────────────────
export class CreateDoctorProfileDto {
  @IsUUID() doctorId!: string; // Provider.id
  @IsString() @IsNotEmpty() @MaxLength(160) displayName!: string;
  @IsOptional() @IsString() @MaxLength(120) specialty?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) subSpecialties?: string[];
  @IsOptional() @IsString() @MaxLength(500) qualifications?: string;
  @IsOptional() @IsString() @MaxLength(80) registrationNumber?: string;
  @IsOptional() @IsString() @MaxLength(4000) bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsString() @MaxLength(20) gender?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) services?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) consultationTypes?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) locationIds?: string[];
  @IsOptional() @IsBoolean() acceptsNewPatients?: boolean;
  @IsOptional() @IsBoolean() acceptsExistingPatients?: boolean;
  @IsOptional() @IsBoolean() telehealthAvailable?: boolean;
}

export class UpdateDoctorProfileDto extends CreateDoctorProfileDto {
  @IsOptional() @IsUUID() declare doctorId: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) declare displayName: string;
}

export class HideReasonDto {
  @IsReason() reason!: string;
}

// ── Appointment type ────────────────────────────────────────────
export class CreateAppointmentTypeDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) price?: number; // minor units
  @IsOptional() @IsIn(CONSULT_TYPES) consultationType?: (typeof CONSULT_TYPES)[number];
  @IsOptional() @IsBoolean() availableForNewPatients?: boolean;
  @IsOptional() @IsBoolean() availableForExistingPatients?: boolean;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAppointmentTypeDto extends CreateAppointmentTypeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) declare name: string;
}

// ── Availability rule ───────────────────────────────────────────
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAvailabilityRuleDto {
  @IsUUID() doctorId!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() @IsNotEmpty() startTime!: string; // HH:mm
  @IsString() @IsNotEmpty() endTime!: string;
  @IsOptional() @IsInt() @Min(5) @Max(240) slotDurationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) bufferMinutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) consultationTypes?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) appointmentTypeIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(50) maxBookingsPerSlot?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAvailabilityRuleDto extends CreateAvailabilityRuleDto {
  @IsOptional() @IsUUID() declare doctorId: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) declare dayOfWeek: number;
  @IsOptional() @IsString() @IsNotEmpty() declare startTime: string;
  @IsOptional() @IsString() @IsNotEmpty() declare endTime: string;
}

// ── Availability override ───────────────────────────────────────
export class CreateAvailabilityOverrideDto {
  @IsUUID() doctorId!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsDateString() date!: string;
  @IsIn(OVERRIDE_TYPES) type!: (typeof OVERRIDE_TYPES)[number];
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export const VALID_TIME = TIME;

// ── Public online booking ───────────────────────────────────────
export class CreateBookingDto {
  @IsUUID() tenantId!: string;
  @IsUUID() doctorId!: string;
  @IsOptional() @IsUUID() appointmentTypeId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsDateString() date!: string; // yyyy-mm-dd
  @IsString() @IsNotEmpty() time!: string; // HH:mm
  @IsIn(['IN_PERSON', 'TELEHEALTH']) consultationType!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) fullName!: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(40) mobile?: string;
  @IsOptional() @IsString() @MaxLength(1000) reasonForVisit?: string;
  @IsOptional() @IsIn(['NEW', 'EXISTING']) newOrExistingPatient?: string;
}

export class ValidateSlotDto {
  @IsUUID() tenantId!: string;
  @IsUUID() doctorId!: string;
  @IsDateString() date!: string;
  @IsString() @IsNotEmpty() time!: string;
  @IsOptional() @IsUUID() appointmentTypeId?: string;
}

// ── Staff online-booking queue (Phase 22.4b) ────────────────────
export class RejectBookingDto {
  @IsReason() reason!: string;
}

export class RescheduleBookingDto {
  @IsDateString() date!: string;
  @IsString() @IsNotEmpty() time!: string; // HH:mm
}

export class LinkBookingPatientDto {
  @IsUUID() patientId!: string;
}

export class RequestAccessDto {
  @IsUUID() tenantId!: string;
  @IsOptional() @IsString() @MaxLength(40) mrn?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsDateString() dob?: string;
}
