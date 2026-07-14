export function success(res, data = null, statusCode = 200) {
  const body = { success: true };
  if (data !== null) {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.assign(body, data);
    } else {
      body.data = data;
    }
  }
  return res.status(statusCode).json(body);
}

export function created(res, data = null) {
  return success(res, data, 201);
}

export function error(res, { statusCode = 500, stage = 'unknown', message = 'Internal server error', details = null, retryable = false } = {}) {
  return res.status(statusCode).json({
    success: false,
    stage,
    message,
    ...(details && { details: typeof details === 'string' ? details : String(details) }),
    retryable,
  });
}

export function paginated(res, { items, total, page, limit }) {
  return res.json({
    success: true,
    data: items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
