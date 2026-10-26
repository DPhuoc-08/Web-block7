// mode=fuzzy: tìm tên GẦN GIỐNG (gõ sai) bằng pg_trgm (plan mục 5.4, 3.3).
// - similarity(name, q): độ giống theo các nhóm 3 ký tự của CẢ tên (không phải word_similarity trên một đoạn tên).
// - Toán tử `%` giữ món có similarity ≥ ngưỡng; ngưỡng công bố của bài tập là 0.3.
// - Ngưỡng đặt bằng set_config(..., is_local = true) — tương đương SET LOCAL — trong CÙNG transaction với câu tìm:
//   app dùng connection pool, đặt cho cả session sẽ "rò" sang request khác dùng lại kết nối đó.
// - Không bỏ dấu: "pho bo" không khớp "Phở bò" (similarity ~0.2) — giới hạn đã nêu trong plan.
// - Thứ tự: similarity (làm tròn 3 chữ số trong SQL, như fulltext.js) giảm dần rồi id tăng dần.
export const FUZZY_THRESHOLD = 0.3;

export async function fuzzyPage(prisma, q, skip, take) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('pg_trgm.similarity_threshold', ${String(FUZZY_THRESHOLD)}, true)`;
      const [row] = await tx.$queryRaw`
        WITH matched AS (
          SELECT d.id, round(similarity(d.name, ${q})::numeric, 3) AS score
          FROM dishes d
          WHERE d.name % ${q}
        )
        SELECT (SELECT count(*) FROM matched)::int AS total,
               coalesce((
                 SELECT json_agg(json_build_object('id', p.id, 'score', p.score) ORDER BY p.score DESC, p.id ASC)
                 FROM (SELECT id, score FROM matched ORDER BY score DESC, id ASC LIMIT ${take} OFFSET ${skip}) p
               ), '[]'::json) AS hits`;
      return { total: row.total, hits: row.hits };
    },
    // Như danh sách basic/advanced: lần đầu sau khi pool nguội có thể quá 2s mặc định (P2028).
    { maxWait: 10_000, timeout: 15_000 },
  );
}
