export const ANALYSIS_ERROR_CODES = [
  "missing_images",
  "signed_url_failed",
  "api_configuration_error",
  "api_timeout",
  "api_network_error",
  "api_http_error",
  "api_invalid_json",
  "api_invalid_response",
  "result_save_failed",
  "unknown",
] as const;

export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[number];

export const ANALYSIS_ERROR_LABELS: Record<AnalysisErrorCode, string> = {
  missing_images: "解析対象の画像不足",
  signed_url_failed: "画像参照URLの発行失敗",
  api_configuration_error: "AI APIの設定不備",
  api_timeout: "AI APIのタイムアウト",
  api_network_error: "AI APIへの接続失敗",
  api_http_error: "AI APIのHTTPエラー",
  api_invalid_json: "AI APIのJSON形式不正",
  api_invalid_response: "AI APIのレスポンス内容不正",
  result_save_failed: "解析結果の保存失敗",
  unknown: "不明な解析エラー",
};

interface AnalysisErrorOptions {
  cause?: unknown;
  httpStatus?: number;
  apiResponseBody?: string;
}

export class AnalysisExecutionError extends Error {
  readonly code: AnalysisErrorCode;
  readonly httpStatus: number | null;
  readonly apiResponseBody: string | null;

  constructor(
    code: AnalysisErrorCode,
    message: string,
    options: AnalysisErrorOptions = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "AnalysisExecutionError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? null;
    this.apiResponseBody = options.apiResponseBody ?? null;
  }
}

export function normalizeAnalysisError(error: unknown): AnalysisExecutionError {
  if (error instanceof AnalysisExecutionError) return error;

  return new AnalysisExecutionError(
    "unknown",
    error instanceof Error ? error.message : "不明な解析エラーが発生しました",
    { cause: error }
  );
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack ?? null,
    };
  }

  return {
    error_name: "UnknownError",
    error_message: String(error),
    error_stack: null,
  };
}

export function createAnalysisFailureLog(
  screeningId: string,
  error: AnalysisExecutionError,
  occurredAt: string
) {
  return {
    event: "ai_analysis_failed",
    screening_id: screeningId,
    error_code: error.code,
    http_status: error.httpStatus,
    api_error_body: error.apiResponseBody,
    occurred_at: occurredAt,
    ...errorDetails(error),
  };
}

export function createAnalysisFailureUpdate(
  error: AnalysisExecutionError,
  occurredAt: string
) {
  return {
    status: "failed" as const,
    analysis_error_code: error.code,
    analysis_error_http_status: error.httpStatus,
    analysis_error_at: occurredAt,
  };
}

export function logAnalysisFailure(
  screeningId: string,
  error: AnalysisExecutionError,
  occurredAt: string
) {
  console.error(
    JSON.stringify(createAnalysisFailureLog(screeningId, error, occurredAt))
  );
}

export function logAnalysisFailurePersistenceError(
  screeningId: string,
  error: unknown,
  occurredAt: string
) {
  console.error(
    JSON.stringify(
      createAnalysisFailurePersistenceLog(screeningId, error, occurredAt)
    )
  );
}

export function createAnalysisFailurePersistenceLog(
  screeningId: string,
  error: unknown,
  occurredAt: string
) {
  return {
    event: "ai_analysis_failure_persistence_failed",
    screening_id: screeningId,
    occurred_at: occurredAt,
    ...errorDetails(error),
  };
}
