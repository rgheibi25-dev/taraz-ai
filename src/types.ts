export type Scope = "site" | "dossier" | "content";
export type Confidence = "high" | "medium" | "low";

export interface QARequest {
  question: string;
  scope?: Scope;
  dossier_slug?: string | null;
  content_slug?: string | null;
  content_type?: string | null;
  page_url?: string;
  page_title?: string;
}

export interface TarazSource {
  title: string;
  public_url: string;
  dossier: string;
  published_date: string;
  relevance: string;
}

export interface QAResponse {
  answer: string;
  key_points: string[];
  confidence: Confidence;
  limitations: string;
  sources: TarazSource[];
  suggested_followups: string[];
}

export interface FileMeta {
  title: string;
  slug: string;
  public_url: string;
  dossier: string;
  dossier_slug: string;
  content_slug: string;
  content_type: string;
  published_status: "published" | "draft" | "private";
  published_date_shamsi: string;
  published_date_gregorian: string;
  language: string;
  qa_enabled: boolean;
  version: string;
  file_id: string;
  vector_store_id: string;
  last_indexed_at: string;
}
