import { NextResponse } from "next/server";

export type ApiFieldErrors = Record<string, string>;

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: ApiFieldErrors,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function apiSuccess<T>(
  data: T,
  status = 200,
): NextResponse {
  return NextResponse.json(
    { data },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
