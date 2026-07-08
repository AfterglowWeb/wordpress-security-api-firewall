type AjaxResponse<T> = {
	success: boolean;
	data: T;
};

function getAjaxurl(): string {
	return (window as any).bromate_totp_data?.ajaxurl;
}

function getNonce(): string {
	return (window as any).bromate_totp_data?.nonce;
}

export async function apiRequest<T>(
	action: string,
	data: Record<string, any> = {}
): Promise<T> {
	const nonce = getNonce();
	const response = await fetch(getAjaxurl(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
		},
		body: new URLSearchParams({
			action,
			nonce,
			...data,
		}),
	});
	
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		const message =
			(body?.data as any)?.message ??
			(typeof body?.data === 'string' ? body.data : null);
		throw new Error(message ?? `HTTP error ${response.status}`);
	}

	const res: AjaxResponse<T> = await response.json();

	if (!res.success) {
		const message =
			(res.data as any)?.message ??
			(typeof res.data === 'string' ? res.data : 'Request failed');
		throw new Error(message);
	}

	return res.data;
}
