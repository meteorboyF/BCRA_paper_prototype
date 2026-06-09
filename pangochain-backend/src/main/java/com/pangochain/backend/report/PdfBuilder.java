package com.pangochain.backend.report;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Minimal, self-paginating PDF writer over Apache PDFBox. Used by the compliance report generator
 * and the court-ready bundle generator. Keeps a vertical cursor and starts a new A4 page whenever
 * content would run off the bottom margin. All text is sanitised to WinAnsi so showText never
 * throws on stray characters from user-supplied data.
 */
public class PdfBuilder implements AutoCloseable {

    private static final PDType1Font REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private static final PDType1Font MONO = new PDType1Font(Standard14Fonts.FontName.COURIER);

    private static final float MARGIN = 56f;        // ~0.78"
    private static final float TOP = PDRectangle.A4.getHeight() - MARGIN;
    private static final float BOTTOM = MARGIN;
    private static final float WIDTH = PDRectangle.A4.getWidth() - 2 * MARGIN;

    private final PDDocument doc = new PDDocument();
    private PDPage page;
    private PDPageContentStream cs;
    private float y;

    public PdfBuilder() {
        newPage();
    }

    private void newPage() {
        try {
            if (cs != null) cs.close();
            page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            cs = new PDPageContentStream(doc, page);
            y = TOP;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void ensure(float needed) {
        if (y - needed < BOTTOM) newPage();
    }

    private static String sanitize(String s) {
        if (s == null) return "";
        // Replace anything outside the printable Latin-1 range so PDType1 WinAnsi encoding is happy.
        return s.replaceAll("[^\\x20-\\x7E\\xA0-\\xFF]", "?");
    }

    private void write(String text, PDType1Font font, float size, float indent) {
        ensure(size + 4);
        try {
            cs.beginText();
            cs.setFont(font, size);
            cs.newLineAtOffset(MARGIN + indent, y);
            cs.showText(sanitize(text));
            cs.endText();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        y -= size + 4;
    }

    public PdfBuilder title(String text) {
        write(text, BOLD, 20, 0);
        y -= 6;
        return this;
    }

    public PdfBuilder subtitle(String text) {
        write(text, REGULAR, 11, 0);
        y -= 8;
        return this;
    }

    public PdfBuilder heading(String text) {
        y -= 8;
        write(text, BOLD, 13, 0);
        y -= 2;
        return this;
    }

    public PdfBuilder paragraph(String text) {
        for (String line : wrap(text, REGULAR, 10.5f, WIDTH)) write(line, REGULAR, 10.5f, 0);
        return this;
    }

    /** A label/value line, e.g. "Total documents:   1,204". */
    public PdfBuilder keyValue(String label, String value) {
        write(label + ":  " + value, REGULAR, 10.5f, 0);
        return this;
    }

    /** A monospaced line — used for hashes and Fabric tx IDs. */
    public PdfBuilder mono(String text) {
        for (String line : wrap(text, MONO, 8.5f, WIDTH)) write(line, MONO, 8.5f, 0);
        return this;
    }

    /** A simple two-column table row (left flush, right indented). */
    public PdfBuilder row(String left, String right) {
        write(left + "   —   " + right, REGULAR, 9.5f, 8);
        return this;
    }

    public PdfBuilder spacer() {
        y -= 10;
        return this;
    }

    public PdfBuilder rule() {
        ensure(8);
        try {
            cs.moveTo(MARGIN, y);
            cs.lineTo(MARGIN + WIDTH, y);
            cs.setLineWidth(0.5f);
            cs.stroke();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        y -= 8;
        return this;
    }

    private List<String> wrap(String text, PDType1Font font, float size, float maxWidth) {
        java.util.List<String> out = new java.util.ArrayList<>();
        for (String hard : sanitize(text).split("\n", -1)) {
            StringBuilder line = new StringBuilder();
            for (String word : hard.split(" ")) {
                String candidate = line.isEmpty() ? word : line + " " + word;
                float w;
                try { w = font.getStringWidth(candidate) / 1000 * size; }
                catch (IOException e) { w = candidate.length() * size * 0.6f; }
                if (w > maxWidth && !line.isEmpty()) {
                    out.add(line.toString());
                    line = new StringBuilder(word);
                } else {
                    line = new StringBuilder(candidate);
                }
            }
            out.add(line.toString());
        }
        return out;
    }

    public byte[] toBytes() {
        try {
            if (cs != null) { cs.close(); cs = null; }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void close() {
        try {
            if (cs != null) cs.close();
            doc.close();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
