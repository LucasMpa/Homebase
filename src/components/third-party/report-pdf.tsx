import "server-only";
import path from "node:path";
import { Document, Font, Page, Path, Rect, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatDate, formatMonth } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { periodLabel, reportFileName, type ExportReport, type ReportLine } from "@/lib/third-party-report";

/*
 * PDF do resumo de gastos de terceiros, no tema escuro do app (mesma paleta de
 * src/app/globals.css). O fundo é desenhado pela própria página, sem margem branca.
 */
const C = {
  background: "#161e2f",
  card: "#242f49",
  muted: "#1d2639",
  border: "#384358",
  foreground: "#e8ecf4",
  mutedForeground: "#9aa4b8",
  primary: "#5fd38d",
  overdue: "#ff8e98",
} as const;

const FONT_DIR = path.join(process.cwd(), "node_modules/@fontsource/geist-sans/files");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONT_DIR, "geist-sans-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "geist-sans-latin-600-normal.woff"), fontWeight: 600 },
  ],
});
// Sem hifenização das palavras comuns (quebraria nomes e descrições no meio).
// Só palavras longas demais para a coluna são partidas em pedaços, para não
// vazarem por cima do valor e da borda do card.
const MAX_WORD = 18;
Font.registerHyphenationCallback((word) =>
  word.length <= MAX_WORD ? [word] : (word.match(new RegExp(`.{1,${MAX_WORD}}`, "gu")) ?? [word]),
);

const s = StyleSheet.create({
  page: {
    backgroundColor: C.background,
    color: C.foreground,
    fontFamily: "Geist",
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 36,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  // Nome do mês nas páginas em que a lista continua; fica no espaço já reservado
  // abaixo do cabeçalho, então não muda a paginação.
  continued: { position: "absolute", top: 32, left: 0, right: 0, fontSize: 12, fontWeight: 600 },
  marker: { position: "absolute", top: 0, left: 0, fontSize: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontSize: 14, fontWeight: 600 },
  muted: { color: C.mutedForeground },
  eyebrow: { color: C.mutedForeground, fontSize: 10, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 600, marginBottom: 4 },
  cards: { flexDirection: "row", gap: 8, marginTop: 18, marginBottom: 12 },
  card: { flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12 },
  cardLabel: { color: C.mutedForeground, fontSize: 9 },
  cardValue: { fontSize: 15, fontWeight: 600, marginTop: 4 },
  notice: {
    backgroundColor: C.muted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 9,
  },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, marginBottom: 6 },
  monthTitle: { fontSize: 12, fontWeight: 600 },
  // Cada linha desenha o seu pedaço do card, para a lista poder continuar na
  // página seguinte sem perder as bordas.
  rowBox: {
    backgroundColor: C.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: C.border,
    borderRightColor: C.border,
    paddingHorizontal: 12,
  },
  rowBoxFirst: { borderTopWidth: 1, borderTopColor: C.border, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  rowBoxLast: { borderBottomWidth: 1, borderBottomColor: C.border, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.border },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontWeight: 600 },
  rowDetail: { color: C.mutedForeground, fontSize: 9, marginTop: 2 },
  amount: { width: 80, textAlign: "right", fontWeight: 600 },
  status: { width: 124, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 3, fontSize: 9 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    color: C.mutedForeground,
    fontSize: 8,
  },
});

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 512 512" width={size} height={size}>
      <Rect x={0} y={0} width={512} height={512} rx={112} fill="#1B2333" />
      <Rect x={6} y={6} width={500} height={500} rx={106} fill="none" stroke="#2A344B" strokeWidth={4} />
      <Path
        d="M110 238 L256 110 L402 238"
        fill="none"
        stroke="#7ED497"
        strokeWidth={44}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={144} y={268} width={58} height={154} rx={16} fill="#E6E9EF" />
      <Rect x={310} y={268} width={58} height={154} rx={16} fill="#E6E9EF" />
      <Rect x={190} y={322} width={132} height={46} rx={10} fill="#E6E9EF" />
    </Svg>
  );
}

function CheckMark() {
  return (
    <Svg viewBox="0 0 24 24" width={9} height={9}>
      <Path d="M20 6 9 17l-5-5" fill="none" stroke={C.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Status({ line }: { line: ReportLine }) {
  if (line.status === "settled") {
    return (
      <View style={s.status}>
        <CheckMark />
        <Text style={s.muted}>Acertada em {formatDate(line.settledAt!)}</Text>
      </View>
    );
  }
  return (
    <View style={s.status}>
      <Text style={{ color: line.status === "overdue" ? C.overdue : C.foreground }}>
        {line.status === "overdue" ? "Atrasada" : "Pendente"}
      </Text>
    </View>
  );
}

/** Registra em que página cada linha caiu (1ª passada do layout). */
type TrackPage = (month: string, page: number) => void;

function Row({
  line,
  month,
  first,
  last,
  showPerson,
  track,
}: {
  line: ReportLine;
  month: string;
  first: boolean;
  last: boolean;
  showPerson: boolean;
  track: TrackPage;
}) {
  return (
    <View style={[s.rowBox, ...(first ? [s.rowBoxFirst] : []), ...(last ? [s.rowBoxLast] : [])]} wrap={false}>
      <Text
        style={s.marker}
        render={({ pageNumber }) => {
          track(month, pageNumber);
          return "";
        }}
      />
      <View style={first ? s.row : [s.row, s.rowDivider]}>
        <View style={s.rowMain}>
          <Text style={s.rowTitle}>{line.description}</Text>
          <Text style={s.rowDetail}>
            {[
              showPerson && line.person,
              `Compra em ${formatDate(line.purchaseDate)}`,
              line.of > 1 ? `Parcela ${line.number}/${line.of}` : "À vista",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Text style={s.amount}>{formatBRL(line.cents)}</Text>
        <Status line={line} />
      </View>
    </View>
  );
}

function ReportDocument({
  report,
  generatedOn,
  validUntil,
  continued,
  track,
}: {
  report: ExportReport;
  generatedOn: string;
  validUntil?: string;
  /** Página → mês cuja lista continua nela (vem da 1ª passada). */
  continued: Map<number, string>;
  track: TrackPage;
}) {
  const showPerson = report.person === null;
  const who = report.person ?? "Todas as pessoas";
  const period = periodLabel(report.from, report.to);

  return (
    <Document title={`Gastos de terceiros · ${who} · ${period}`} author="Homebase" creator="Homebase" producer="Homebase">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.brand}>
            <LogoMark />
            <Text style={s.brandName}>Homebase</Text>
          </View>
          <Text style={[s.muted, { fontSize: 9 }]}>Emitido em {formatDate(generatedOn)}</Text>
          <Text
            style={s.continued}
            render={({ pageNumber }) => {
              const month = continued.get(pageNumber);
              return month ? `${formatMonth(month)} (continuação)` : "";
            }}
          />
        </View>

        <Text style={s.eyebrow}>Resumo de gastos de terceiros</Text>
        <Text style={s.title}>{who}</Text>
        <Text style={s.muted}>Parcelas de {period}</Text>

        <View style={s.cards}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total no período</Text>
            <Text style={s.cardValue}>{formatBRL(report.totals.totalCents)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Já recebido</Text>
            <Text style={s.cardValue}>{formatBRL(report.totals.settledCents)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>A receber</Text>
            <Text style={[s.cardValue, { color: C.primary }]}>{formatBRL(report.totals.pendingCents)}</Text>
          </View>
          {report.totals.overdueCents > 0 && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Atrasado</Text>
              <Text style={[s.cardValue, { color: C.overdue }]}>{formatBRL(report.totals.overdueCents)}</Text>
            </View>
          )}
        </View>

        {report.earlier.cents > 0 && (
          <Text style={[s.notice, report.earlier.overdue ? { color: C.overdue } : {}]}>
            + {formatBRL(report.earlier.cents)} pendente de antes de {formatMonth(report.from)} (
            {report.earlier.count} {report.earlier.count === 1 ? "parcela" : "parcelas"}), fora deste resumo.
          </Text>
        )}

        {report.months.map((m) => {
          const header = (
            <View style={s.monthHeader}>
              <Text style={s.monthTitle}>{formatMonth(m.month)}</Text>
              {m.lines.length === 0 ? (
                <Text style={[s.muted, { fontSize: 9 }]}>Nenhuma parcela</Text>
              ) : (
                <Text style={{ fontWeight: 600 }}>
                  {formatBRL(m.totalCents)}
                  {m.settledCents > 0 && m.pendingCents > 0 ? (
                    <Text style={[s.muted, { fontWeight: 400, fontSize: 9 }]}> · faltam {formatBRL(m.pendingCents)}</Text>
                  ) : null}
                </Text>
              )}
            </View>
          );
          const rows = m.lines.map((line, i) => (
            <Row key={`${line.expenseId}-${line.number}`} line={line} month={m.month} track={track} first={i === 0} last={i === m.lines.length - 1} showPerson={showPerson} />
          ));
          // Meses curtos ficam inteiros numa página. Nos longos, o título vai
          // sempre junto da primeira linha (nunca sozinho no pé da página).
          return m.lines.length <= 8 ? (
            <View key={m.month} wrap={false}>
              {header}
              {rows}
            </View>
          ) : (
            <View key={m.month}>
              <View wrap={false}>
                {header}
                {rows[0]}
              </View>
              {rows.slice(1)}
            </View>
          );
        })}

        <View style={s.footer} fixed>
          <Text>{validUntil ? `Link válido até ${formatDate(validUntil)}` : "Gerado pelo Homebase"}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Resposta HTTP com o PDF do relatório. `inline` abre no navegador; senão, baixa. */
export async function reportPdfResponse(
  report: ExportReport,
  { generatedOn, validUntil, inline = false }: { generatedOn: string; validUntil?: string; inline?: boolean },
): Promise<Response> {
  const props = { report, generatedOn, validUntil };
  // 1ª passada: em que páginas caem as linhas de cada mês. 2ª: o mesmo layout,
  // com o nome do mês no topo das páginas em que a lista dele continua.
  const pagesByMonth = new Map<string, Set<number>>();
  const firstPass = await renderToBuffer(
    <ReportDocument
      {...props}
      continued={new Map()}
      track={(month, page) => pagesByMonth.set(month, (pagesByMonth.get(month) ?? new Set()).add(page))}
    />,
  );
  const continued = new Map<number, string>();
  for (const [month, pages] of pagesByMonth) {
    const first = Math.min(...pages);
    for (const page of pages) if (page > first && !continued.has(page)) continued.set(page, month);
  }
  // Sem mês dividido entre páginas (o caso comum), a 1ª passada já é o PDF final.
  const buffer =
    continued.size === 0
      ? firstPass
      : await renderToBuffer(<ReportDocument {...props} continued={continued} track={() => {}} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${reportFileName(report)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
