import type { ToolbarPanelRefs, ToolbarSectionContext } from './types';
import { buildWriteSection } from './write';
import { buildShapesSection } from './shapes';
import { buildTextSection } from './text';
import { buildEditSection } from './edit';
import { buildExportSection } from './export';

export function createToolbarSections(ctx: ToolbarSectionContext): ToolbarPanelRefs {
  const write = buildWriteSection(ctx);
  const shapes = buildShapesSection(ctx);
  const text = buildTextSection(ctx);
  const edit = buildEditSection(ctx);
  const exp = buildExportSection(ctx);

  return {
    colorInput: write.colorInput,
    widthLabel: write.widthLabel,
    widthDot: write.widthDot,
    opacitySlider: write.opacitySlider,
    fontFamilySelect: text.fontFamilySelect,
    fillBtn: shapes.fillBtn,
    roughnessBtn: shapes.roughnessBtn,
    dashBtn: shapes.dashBtn,
    pixelEraseBtn: shapes.pixelEraseBtn,
    cornerRadiusSlider: shapes.cornerRadiusSlider,
    groupBtn: edit.groupBtn,
    ungroupBtn: edit.ungroupBtn,
    rotateBtn: edit.rotateBtn,
    applyStyleBtn: edit.applyStyleBtn,
    svgBtn: exp.svgBtn,
    pngBtn: exp.pngBtn,
    pdfBtn: exp.pdfBtn,
    saveBtn: exp.saveBtn,
    graphBtn: exp.graphBtn,
    themeBtn: exp.themeBtn,
    presentBtn: exp.presentBtn,
    latexBtn: exp.latexBtn,
  };
}