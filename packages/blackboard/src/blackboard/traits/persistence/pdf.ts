export function buildPdfBlob(dataUrl: string, pdfW: number, pdfH: number, imgWidth: number, imgHeight: number): Blob {
  const obj: string[] = [];
  obj.push('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj');
  obj.push('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj');
  obj.push(`3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pdfW} ${pdfH}]/Contents 4 0 R/Resources<</XObject<</Img 5 0 R>>>>>>endobj`);
  const contentStream = `q ${pdfW} 0 0 ${pdfH} 0 0 cm /Img Do Q`;
  obj.push(`4 0 obj<</Length ${contentStream.length}>>\nstream\n${contentStream}\nendstream\nendobj`);
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const binaryBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    binaryBytes[i] = binaryString.charCodeAt(i);
  }
  obj.push(`5 0 obj<</Type/XObject/Subtype/Image/Width ${imgWidth}/Height ${imgHeight}/ColorSpace/DeviceRGB/BitsPerComponent 8/Length ${binaryBytes.length}/Filter/DCTDecode>>stream`);
  const objHeader = obj.join('\n') + '\n';
  let offset = 0;
  const offsets: number[] = [];
  for (const o of obj) {
    offsets.push(offset);
    offset += o.length + 1;
  }
  const imageStart = offset;
  offset += binaryBytes.length;
  const objFooter = 'endstream\nendobj\n';
  offset += objFooter.length;
  const xrefOffset = offset;
  const xref = 'xref\n0 6\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + String(imageStart).padStart(10, '0') + ' 00000 n \n';
  const trailer = `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  const totalLength = xrefOffset + xref.length + trailer.length;
  const pdfBuffer = new Uint8Array(totalLength);
  let writePos = 0;
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      pdfBuffer[writePos++] = s.charCodeAt(i);
    }
  };
  writeString(objHeader);
  pdfBuffer.set(binaryBytes, writePos);
  writePos += binaryBytes.length;
  writeString(objFooter);
  writeString(xref);
  writeString(trailer);
  return new Blob([pdfBuffer], { type: 'application/pdf' });
}