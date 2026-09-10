import { BlackboardBase } from './blackboard/base';
import { CameraMixin } from './blackboard/traits/camera';
import { ElementsMixin } from './blackboard/traits/elements';
import { SetupMixin } from './blackboard/traits/setup';
import { GeometryMixin } from './blackboard/traits/geometry';
import { RenderCanvasMixin } from './blackboard/traits/render-canvas';
import { RenderElementsMixin } from './blackboard/traits/render-elements';
import { RenderSelectionMixin } from './blackboard/traits/render-selection';
import { RenderLaserMixin } from './blackboard/traits/render-laser';
import { ToolsMixin } from './blackboard/traits/tools';
import { ToolsDefsMixin } from './blackboard/traits/tools-defs';
import { ToolsShapeMixin } from './blackboard/traits/tools-shape';
import { UndoRedoMixin } from './blackboard/traits/undo-redo';
import { InputMixin } from './blackboard/traits/input';
import { UiMixin } from './blackboard/traits/ui';
import { CollabMixin } from './blackboard/traits/collab';
import { PersistenceMixin } from './blackboard/traits/persistence';
import { MiscMixin } from './blackboard/traits/misc';
import type { BlackboardAPI } from './types';

const BlackboardImpl = SetupMixin(MiscMixin(PersistenceMixin(CollabMixin(UiMixin(InputMixin(ToolsShapeMixin(ToolsDefsMixin(ToolsMixin(UndoRedoMixin(RenderCanvasMixin(RenderSelectionMixin(RenderElementsMixin(RenderLaserMixin(GeometryMixin(ElementsMixin(CameraMixin(BlackboardBase)))))))))))))))));
export class Blackboard extends BlackboardImpl implements BlackboardAPI {}
