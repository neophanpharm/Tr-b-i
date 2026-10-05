// Chỉ chạy trên máy chủ. Không đặt khóa API hoặc địa chỉ riêng tư trong mã nguồn.
export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LETTER_TO_EMAIL);
}

export async function sendAnswersEmail({ id, entries }, {
  apiKey = process.env.RESEND_API_KEY,
  to = process.env.LETTER_TO_EMAIL,
  from = process.env.LETTER_FROM_EMAIL || 'Gui cau <onboarding@resend.dev>',
  fetchImpl = fetch
} = {}) {
  if (!apiKey || !to || !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(to)) throw new Error('Email configuration is missing or invalid');
  const text = ['Cậu ấy đã trả lời đủ 5 câu hỏi.', '', ...entries.flatMap((entry, index) => [`${index + 1}. ${entry.question}`, entry.answer, ''])].join('\n');
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `letter-answers/${id}` },
    body: JSON.stringify({ from, to: [to], subject: 'Gửi cậu — 5 câu trả lời mới', text }),
    signal: AbortSignal.timeout(12000)
  });
  // Không ghi log phản hồi dịch vụ vì có thể chứa nội dung hoặc địa chỉ email.
  if (!response.ok) throw new Error(`Email service returned ${response.status}`);
  const result = await response.json();
  if (!result.id) throw new Error('Email service did not confirm acceptance');
  return result.id;
}
