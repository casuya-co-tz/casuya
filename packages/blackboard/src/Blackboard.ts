import { BlackboardBase } from './blackboard/base';
import { GeometryMixin } from './blackboard/traits/geometry';
import { RenderMixin } from './blackboard/traits/render';
import { ToolsMixin } from './blackboard/traits/tools';
import { InputMixin } from './blackboard/traits/input';
import { UiMixin } from './blackboard/traits/ui';
import { CollabMixin } from './blackboard/traits/collab';
import { PersistenceMixin } from './blackboard/traits/persistence';
import { MiscMixin } from './blackboard/traits/misc';
import type { BlackboardAPI } from './types';

const BlackboardImpl = MiscMixin(PersistenceMixin(CollabMixin(UiMixin(InputMixin(ToolsMixin(RenderMixin(GeometryMixin(BlackboardBase))))))));
export class Blackboard extends BlackboardImpl implements BlackboardAPI {}
