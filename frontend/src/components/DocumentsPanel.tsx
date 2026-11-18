import {
  ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_MAX_BYTES,
  AttachmentKind,
  attachmentFilePath,
  type AnalyzeDocumentResponse,
  type Attachment,
  type MeasurementReading,
  type PregnancyDating,
} from "@ona-bola/shared";
import { useRef, useState, type DragEvent } from "react";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { formatDate, formatDateTime, formatNumber, unitLabel } from "../i18n/format";
import { ApiError } from "../services/api";
import {
  useAiEnabled,
  useAnalyzeDocument,
  useAttachments,
  useUpdatePatient,
  useUploadAttachment,
} from "../services/queries";
import { AiBadge } from "./AiBadge";
import { DimedBadge } from "./DimedBadge";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.dcm,application/pdf,image/jpeg,image/png,application/dicom";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 focus:border-rose-600";

/** A browser reports no type for .dcm files, so accept them by extension too. */
const isAccepted = (file: File) =>
  (ATTACHMENT_CONTENT_TYPES as readonly string[]).includes(file.type) || /\.dcm$/i.test(file.name);

const fileUrl = (a: Attachment) => attachmentFilePath(a.id);

/** 413: over 10 MB. 415: not a PDF, JPG, PNG or DICOM (the server checks the content). */
export function uploadProblem(error: unknown, s: ReturnType<typeof useStrings>): string {
  if (error instanceof ApiError && error.status === 413) return s.docs.tooBig;
  if (error instanceof ApiError && error.status === 415) return s.docs.badType;
  return s.docs.failed;
}
const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${formatNumber(Math.round(bytes / 1024 / 102.4) / 10)} MB`
    : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;

function readingText(r: MeasurementReading, lang: "uz" | "ru" | "en") {
  const value =
    r.type === "BLOOD_PRESSURE" ? `${r.systolic}/${r.diastolic}` : formatNumber(r.value);
  return `${value} ${unitLabel(r.unit, lang)}`;
}

/** "Ultrasound 2026-11-02, 24 wk 3 d": what the report says about the dating. */
function datingText(
  d: PregnancyDating,
  s: ReturnType<typeof useStrings>,
  lang: "uz" | "ru" | "en",
) {
  if (d.method === "LMP") return `${s.register.datedBy.LMP}: ${formatDate(d.lmpDate, lang)}`;
  return `${s.register.datedBy.ULTRASOUND}: ${formatDate(d.scanDate, lang)}, ${d.weeks} ${s.register.weeksShort} ${d.days} ${s.register.daysShort}`;
}

/**
 * Claude reads a report (violet = AI). It only proposes: the values go to the visit form and the
 * dating to the chart when the doctor presses the button; nothing is saved before that.
 */
function AnalyzeButton({
  patientId,
  attachment,
  onUseDraft,
}: {
  patientId: string;
  attachment: Attachment;
  onUseDraft: (draft: AnalyzeDocumentResponse["draft"]) => void;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const canAddVisit = useCan("VISIT_ADD");
  const canEditPatient = useCan("PATIENT_EDIT");
  const aiOn = useAiEnabled();
  const analyze = useAnalyzeDocument();
  const saveDating = useUpdatePatient(patientId);
  const result = analyze.data;
  const draft = result?.draft;
  const found = draft && draft.measurements.length > 0;
  const action =
    "rounded-lg bg-violet-700 px-3.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:bg-slate-300";
  const problem =
    analyze.error instanceof ApiError && analyze.error.code === "AI_UNAVAILABLE"
      ? s.ai.unavailable
      : analyze.error
        ? s.docs.failed
        : null;
  return (
    <div className="mt-3">
      <button
        type="button"
        data-ai-read={attachment.id}
        disabled={analyze.isPending || !aiOn}
        onClick={() => analyze.mutate({ id: attachment.id, language: lang })}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3.5 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
      >
        <AiBadge />
        {analyze.isPending ? s.docs.reading : s.docs.readWithAi}
      </button>
      {aiOn ? null : <p className="mt-2 text-sm text-violet-900">{s.ai.offShort}</p>}
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {problem}
        </p>
      ) : null}
      {result && draft ? (
        <div
          data-ai-draft
          className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold text-violet-900">
            <AiBadge />
            {s.docs.draftTitle}
          </p>
          {found ? (
            <ul className="list-disc pl-5 text-slate-800">
              {draft.measurements.map((m) => (
                <li key={m.type}>{readingText(m, lang)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-600">{s.docs.draftNothing}</p>
          )}
          {result.dating ? (
            <p className="text-slate-800">
              {s.docs.datingFound}: <strong>{datingText(result.dating, s, lang)}</strong>
            </p>
          ) : null}
          {result.warnings.map((w) => (
            <p key={w} className="text-amber-800">
              {w}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            {found && canAddVisit ? (
              <button
                type="button"
                data-ai-use-draft
                onClick={() => onUseDraft(draft)}
                className={`${action} py-2`}
              >
                {s.docs.useInVisit}
              </button>
            ) : null}
            {result.dating && canEditPatient ? (
              <button
                type="button"
                data-ai-save-dating
                disabled={saveDating.isPending || saveDating.isSuccess}
                onClick={() => saveDating.mutate({ dating: result.dating ?? undefined })}
                className={`${action} py-2`}
              >
                {saveDating.isSuccess ? s.docs.datingSaved : s.docs.saveDating}
              </button>
            ) : null}
          </div>
          {saveDating.isError ? (
            <p role="alert" className="text-red-700">
              {s.docs.failed}
            </p>
          ) : null}
          <p className="text-xs text-violet-900/80">
            {s.docs.notSavedYet} · {s.ai.model}: {result.model}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Preview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const s = useStrings();
  const url = fileUrl(attachment);
  const isImage = attachment.contentType.startsWith("image/");
  const isPdf = attachment.contentType === "application/pdf";
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100 p-2">
      {isImage ? (
        <img src={url} alt={attachment.fileName} className="mx-auto max-h-[28rem] rounded" />
      ) : isPdf ? (
        <iframe
          src={url}
          title={attachment.fileName}
          className="h-[28rem] w-full rounded bg-white"
        />
      ) : (
        <p className="p-4 text-slate-600">{s.docs.noPreview}</p>
      )}
      <div className="mt-2 flex gap-3 px-1 text-sm">
        <a
          href={url}
          download={attachment.fileName}
          className="font-semibold text-rose-800 underline"
        >
          {s.docs.download}
        </a>
        <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-900">
          {s.docs.close}
        </button>
      </div>
    </div>
  );
}

/** The "Documents" tab: upload (drag and drop or button), list, preview, DIMED status. */
export function DocumentsPanel({
  patientId,
  onUseDraft,
}: {
  patientId: string;
  onUseDraft: (draft: AnalyzeDocumentResponse["draft"]) => void;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const canUpload = useCan("ATTACHMENT_UPLOAD");
  const canUseAi = useCan("AI_USE");
  const list = useAttachments(patientId);
  const upload = useUploadAttachment(patientId);
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AttachmentKind>("ULTRASOUND");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  function pick(picked: File | undefined) {
    setProblem(null);
    if (!picked) return;
    if (!isAccepted(picked)) return setProblem(s.docs.badType);
    if (picked.size > ATTACHMENT_MAX_BYTES) return setProblem(s.docs.tooBig);
    setFile(picked);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  }

  function send() {
    if (!file) return;
    upload.mutate(
      { file, kind, description },
      {
        onSuccess: () => {
          setFile(null);
          setDescription("");
          if (input.current) input.current.value = "";
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{s.docs.title}</h2>

      {canUpload ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div
            id="doc-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-rose-600 bg-rose-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <p className="text-slate-700">{file ? file.name : s.docs.drop}</p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-lg border border-rose-800 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50"
            >
              {s.docs.choose}
            </button>
            <p className="text-sm text-slate-500">{s.docs.formats}</p>
            <input
              ref={input}
              id="doc-file"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label={s.docs.choose}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-red-700">
              {problem}
            </p>
          ) : null}

          {file ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                {s.docs.kind}
                <select
                  id="doc-kind"
                  value={kind}
                  onChange={(e) => setKind(AttachmentKind.parse(e.target.value))}
                  className={field}
                >
                  {AttachmentKind.options.map((value) => (
                    <option key={value} value={value}>
                      {s.docs.kinds[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {s.docs.description}
                <input
                  type="text"
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                  className={field}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  id="doc-upload"
                  disabled={upload.isPending}
                  onClick={send}
                  className="rounded-lg bg-rose-800 px-5 text-sm font-semibold text-white hover:bg-rose-900 disabled:bg-slate-300"
                >
                  {upload.isPending ? s.docs.uploading : s.docs.upload}
                </button>
              </div>
            </div>
          ) : null}
          {upload.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {uploadProblem(upload.error, s)}
            </p>
          ) : null}
          <p className="text-sm text-slate-500">{s.docs.syntheticOnly}</p>
        </div>
      ) : null}

      {list.isPending ? <p className="text-slate-500">{s.common.loading}</p> : null}
      {list.isError ? <p className="text-red-700">{s.common.loadError}</p> : null}
      {list.data && list.data.items.length === 0 ? (
        <p className="text-slate-500">{s.docs.empty}</p>
      ) : null}

      <ul className="space-y-3">
        {list.data?.items.map((a) => {
          const isOpen = open === a.id;
          const readable =
            a.contentType === "application/pdf" || a.contentType.startsWith("image/");
          return (
            <li
              key={a.id}
              data-document={a.kind}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {s.docs.kinds[a.kind]}
                </span>
                <span className="font-semibold text-slate-900">{a.fileName}</span>
                <span className="text-sm text-slate-500">{kb(a.sizeBytes)}</span>
                <span className="sm:ml-auto">
                  <DimedBadge status={a.dimedStatus} />
                </span>
              </div>
              {a.description ? <p className="mt-1 text-slate-700">{a.description}</p> : null}
              <p className="mt-1 text-sm text-slate-500">
                {s.docs.by}: {a.uploadedBy.displayName} · {formatDateTime(a.uploadedAt, lang)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : a.id)}
                  className="rounded-lg border border-rose-800 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50"
                >
                  {s.docs.view}
                </button>
                <a
                  href={fileUrl(a)}
                  download={a.fileName}
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {s.docs.download}
                </a>
              </div>
              {isOpen ? <Preview attachment={a} onClose={() => setOpen(null)} /> : null}
              {canUseAi && readable ? (
                <AnalyzeButton patientId={patientId} attachment={a} onUseDraft={onUseDraft} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
