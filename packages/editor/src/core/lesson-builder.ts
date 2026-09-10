import { LessonBuilderBase } from './builder/base.js';
import { LessonInfoTrait } from './builder/lesson-info.js';
import { SlidesTrait } from './builder/slides.js';
import { ComponentsTrait } from './builder/components.js';
import { HistoryTrait } from './builder/history.js';
import { IoTrait } from './builder/io.js';
import { LifecycleTrait } from './builder/lifecycle.js';

const LessonBuilderInstance = LifecycleTrait(
  IoTrait(
    HistoryTrait(
      ComponentsTrait(
        SlidesTrait(
          LessonInfoTrait(LessonBuilderBase),
        ),
      ),
    ),
  ),
);

export type { LessonBuilderBase };
export type LessonBuilder = InstanceType<typeof LessonBuilderInstance>;
export const LessonBuilder = LessonBuilderInstance;