export interface UploadedFile {
  id: string;
  viewUrl: string;
  downloadUrl: string;
}

export interface DocumentUploader {
  uploadDocument(file: Buffer, filename: string): Promise<UploadedFile>;
}

export interface Kv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
