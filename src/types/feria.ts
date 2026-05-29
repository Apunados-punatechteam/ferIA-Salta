export type EntityType =
  | "entrepreneur_profile"
  | "fair_application"
  | "fair_certificate"
  | "assistant_message"
  | "payment_record"
  | "user_profile"
  | "fair_event"
  | "fair_event_decision"
  | "fair_registration"
  | "municipality_decision";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
};

export type UserRole = "entrepreneur" | "fair_organizer" | "municipality";

export type AuthUser = {
  id: string;
  username?: string;
  fullName: string;
  documentNumber: string;
  role: UserRole;
  createdAt: number;
};

export type EntrepreneurProfile = {
  fullName: string;
  documentNumber: string;
  businessName: string;
  category: string;
  city: string;
  phone: string;
  createdAt: number;
};

export type FairApplicationStatus =
  | "draft"
  | "submitted"
  | "payment_pending"
  | "paid"
  | "approved";

export type FairApplication = {
  profileKey: string;
  fairName: string;
  fairSlug: string;
  productDescription: string;
  requirements: string[];
  status: FairApplicationStatus;
  createdAt: number;
};

export type FairCertificate = {
  applicationKey: string;
  registrationKey?: string;
  decisionKey?: string;
  certificateNumber: string;
  holderName: string;
  businessName: string;
  fairName: string;
  approvedBy?: string;
  municipalApprovalAt?: number;
  issuedAt: number;
  status: "issued";
};

export type FairMapEventStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "draft"
  | "closed";

export type FairMapEvent = {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  category: string;
  startDate: string;
  endDate: string;
  availableSlots: number;
  latitude: number;
  longitude: number;
  status: FairMapEventStatus;
};

export type FairEventPayload = FairMapEvent & {
  createdAt: number;
  publishedBy?: string;
  createdByRole?: string;
  createdByName?: string;
  createdByDocument?: string;
};

export type FairRegistrationStatus = "pending" | "approved" | "rejected";

export type FairRegistration = {
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  category: string;
  productDescription: string;
  phone: string;
  city: string;
  status: FairRegistrationStatus;
  createdAt: number;
};

export type MunicipalityDecisionValue = "approved" | "rejected";

export type MunicipalityDecision = {
  registrationKey: string;
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  decision: MunicipalityDecisionValue;
  decidedBy: string;
  notes: string;
  decidedAt: number;
};

export type EntitySource = "local_demo" | "arkiv_real";

export type LocalArkivEntity<TPayload> = {
  entityKey: string;
  payload: TPayload;
  contentType: "application/json";
  attributes: Array<{
    key: string;
    value: string | number;
  }>;
  expiresIn: number;
  createdAt: number;
  txHash?: string;
  source?: EntitySource;
};

export type FeriaState = {
  profileEntity?: LocalArkivEntity<EntrepreneurProfile>;
  applicationEntity?: LocalArkivEntity<FairApplication>;
  certificateEntity?: LocalArkivEntity<FairCertificate>;
  registrationEntity?: LocalArkivEntity<FairRegistration>;
};