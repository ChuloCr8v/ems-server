export class SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    encoding?: string;
    cid?: string; // For embedded images
    path?: string; // If using file paths instead of buffers
  }>;
}
