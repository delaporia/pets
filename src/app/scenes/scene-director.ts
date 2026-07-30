import type { StageEntity } from "../stage/entity";
import { EntityRegistry } from "../stage/entity-registry";
import { SceneScope } from "./scene-scope";
import type {
  SceneDefinition,
  SceneEntityDeclaration,
  SceneEvent,
} from "./timeline";
import { TimelinePlayer } from "./timeline-player";

export type SceneEntityFactory = (
  declaration: SceneEntityDeclaration,
) => StageEntity;

export type SceneResult =
  | {
      sceneId: string;
      status: "completed";
    }
  | {
      sceneId: string;
      status: "interrupted";
      reason: string;
    };

interface ActiveScene {
  definition: SceneDefinition;
  player: TimelinePlayer;
  scope: SceneScope;
  resolve: (result: SceneResult) => void;
}

export class SceneDirector {
  private active: ActiveScene | undefined;

  constructor(
    private readonly registry: EntityRegistry,
    private readonly createEntity: SceneEntityFactory,
    private readonly onEvent: (event: SceneEvent) => void = () =>
      undefined,
  ) {}

  get activeSceneId(): string | undefined {
    return this.active?.definition.id;
  }

  play(definition: SceneDefinition): Promise<SceneResult> {
    if (this.active) {
      throw new Error(
        `Scene "${this.active.definition.id}" is already active`,
      );
    }

    const scope = new SceneScope(this.registry);
    try {
      for (const declaration of definition.entities) {
        scope.add(this.createEntity(declaration));
      }
    } catch (error) {
      scope.release();
      throw error;
    }

    const player = new TimelinePlayer(
      definition,
      (id) => this.registry.get(id),
      this.onEvent,
    );
    try {
      // Prime every tracked actor before the next stage bounds pass. Newly
      // registered scene props otherwise spend one frame at the entity
      // factory's fallback origin and can expand the transparent window to
      // the corner of the screen.
      player.update(0);
    } catch (error) {
      scope.release();
      throw error;
    }
    return new Promise<SceneResult>((resolve) => {
      this.active = { definition, player, scope, resolve };
    });
  }

  update(deltaMs: number): void {
    const active = this.active;
    if (!active) return;
    active.player.update(deltaMs);
    if (!active.player.complete) return;

    const pet = this.registry.get(
      active.definition.settlement.petEntityId,
    );
    if (pet) {
      pet.transform.position = {
        ...active.definition.settlement.petPosition,
      };
    }
    this.finish({
      sceneId: active.definition.id,
      status: "completed",
    });
  }

  interrupt(reason: string): boolean {
    const active = this.active;
    if (!active) return false;
    this.finish({
      sceneId: active.definition.id,
      status: "interrupted",
      reason,
    });
    return true;
  }

  private finish(result: SceneResult): void {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    active.scope.release();
    active.resolve(result);
  }
}
