import { LessonBuilder, ComponentType, SlideLayout } from '../src/index.js';

const builder = new LessonBuilder();

const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const slidesEl = document.querySelector<HTMLDivElement>('#slides')!;
const previewEl = document.querySelector<HTMLDivElement>('#preview')!;
const jsonEl = document.querySelector<HTMLPreElement>('#json')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;

titleInput.addEventListener('input', () => {
  builder.setTitle(titleInput.value || 'Untitled Lesson');
  render();
});

document.querySelector('#addSlide')!.addEventListener('click', () => {
  const slide = builder.addSlide(`Slide ${builder.getSlideManager().getAll().length + 1}`, SlideLayout.Content);
  builder.setActiveSlide(slide.id);
  statusEl.textContent = `Added ${slide.title}`;
  render();
});

document.querySelector('#addText')!.addEventListener('click', () => {
  const active = builder.getActiveSlideId();
  if (!active) {
    statusEl.textContent = 'Add a slide first';
    return;
  }
  builder.addComponent(active, ComponentType.Text, { content: 'New text block' });
  statusEl.textContent = 'Added text component';
  render();
});

document.querySelector('#addImage')!.addEventListener('click', () => {
  const active = builder.getActiveSlideId();
  if (!active) {
    statusEl.textContent = 'Add a slide first';
    return;
  }
  builder.addComponent(active, ComponentType.Image, { src: 'https://picsum.photos/400/200', alt: 'Demo image' });
  statusEl.textContent = 'Added image component';
  render();
});

document.querySelector('#undo')!.addEventListener('click', () => {
  if (builder.undo()) statusEl.textContent = 'Undid last action';
  render();
});

document.querySelector('#redo')!.addEventListener('click', () => {
  if (builder.redo()) statusEl.textContent = 'Redid last action';
  render();
});

document.querySelector('#export')!.addEventListener('click', () => {
  const data = builder.exportToJson();
  navigator.clipboard?.writeText(data);
  statusEl.textContent = 'Lesson JSON copied to clipboard';
});

function render() {
  const lesson = builder.getLesson();
  titleInput.value = lesson.title;

  slidesEl.innerHTML = '';
  lesson.slides.forEach((slide, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${i + 1}. ${slide.title}`;
    btn.addEventListener('click', () => {
      builder.setActiveSlide(slide.id);
      render();
    });
    if (builder.getActiveSlideId() === slide.id) btn.style.borderColor = 'var(--accent)';
    slidesEl.appendChild(btn);
  });

  previewEl.innerHTML = '';
  lesson.slides.forEach((slide) => {
    const slideEl = document.createElement('div');
    slideEl.className = 'slide';
    const h = document.createElement('h3');
    h.textContent = slide.title;
    slideEl.appendChild(h);
    slide.components.forEach((c: any) => {
      const comp = document.createElement('div');
      comp.className = 'comp';
      if (c.type === ComponentType.Text) comp.textContent = c.content;
      else if (c.type === ComponentType.Image) {
        const img = document.createElement('img');
        img.src = c.src;
        img.style.maxWidth = '100%';
        comp.appendChild(img);
      } else comp.textContent = String(c.type);
      slideEl.appendChild(comp);
    });
    previewEl.appendChild(slideEl);
  });

  jsonEl.textContent = JSON.stringify(lesson, null, 2);
}

render();
