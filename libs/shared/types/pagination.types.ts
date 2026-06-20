// ─── Pagination meta ──────────────────────────────────────────────────────────

/**
 * Pagination metadata returned alongside every paginated list endpoint.
 * Matches the existing PaginationMeta shape in types/index.ts.
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Generic paginated response ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ─── Pagination query params ──────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}
