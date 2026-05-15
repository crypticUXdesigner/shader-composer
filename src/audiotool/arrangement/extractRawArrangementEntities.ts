import type { EntityQuery, NexusEntityUnion, NexusLocation } from '@audiotool/nexus/document';
import type { ArrangementSnapshotSource } from './types';
import type {
  RawArrangementEntities,
  RawAudioRegion,
  RawConfig,
  RawEntityLabels,
  RawNote,
  RawNoteRegion,
  RawNoteTrack,
  RawPatternRegion,
} from './rawEntities';

function playerEntityId(player: NexusLocation): string {
  return player.entityId;
}

function readRegionFields(
  regionObj: {
    fields: {
      positionTicks: { value: number };
      durationTicks: { value: number };
      collectionOffsetTicks?: { value: number };
      loopOffsetTicks?: { value: number };
      loopDurationTicks?: { value: number };
      isEnabled: { value: boolean };
      displayName: { value: string };
      colorIndex: { value: number };
    };
  },
  includeNoteRegionFields: boolean
): RawNoteRegion['region'] {
  const f = regionObj.fields;
  const displayName = f.displayName.value.trim();
  const out: RawNoteRegion['region'] = {
    positionTicks: f.positionTicks.value,
    durationTicks: f.durationTicks.value,
    isEnabled: f.isEnabled.value,
    ...(displayName.length > 0 ? { displayName } : {}),
    colorIndex: f.colorIndex.value,
  };
  if (includeNoteRegionFields) {
    if (f.collectionOffsetTicks !== undefined) {
      out.collectionOffsetTicks = f.collectionOffsetTicks.value;
    }
    if (f.loopOffsetTicks !== undefined) {
      out.loopOffsetTicks = f.loopOffsetTicks.value;
    }
    if (f.loopDurationTicks !== undefined) {
      out.loopDurationTicks = f.loopDurationTicks.value;
    }
  }
  return out;
}

function readTrackRow(
  entity: NexusEntityUnion<'noteTrack' | 'audioTrack' | 'patternTrack'>
): RawNoteTrack {
  return {
    id: entity.id,
    orderAmongTracks: entity.fields.orderAmongTracks.value,
    isEnabled: entity.fields.isEnabled.value,
    playerEntityId: playerEntityId(entity.fields.player.value),
  };
}

function readNoteRegion(entity: NexusEntityUnion<'noteRegion'>): RawNoteRegion {
  return {
    id: entity.id,
    collectionEntityId: entity.fields.collection.value.entityId,
    trackEntityId: entity.fields.track.value.entityId,
    region: readRegionFields(entity.fields.region, true /* noteRegion: collection + loop */),
  };
}

function readAudioRegion(entity: NexusEntityUnion<'audioRegion'>): RawAudioRegion {
  return {
    id: entity.id,
    trackEntityId: entity.fields.track.value.entityId,
    region: readRegionFields(entity.fields.region, false /* audio: outer span only */),
  };
}

function readPatternRegion(entity: NexusEntityUnion<'patternRegion'>): RawPatternRegion {
  return {
    id: entity.id,
    trackEntityId: entity.fields.track.value.entityId,
    region: readRegionFields(entity.fields.region, false /* pattern: outer span only */),
    patternIndex: entity.fields.patternIndex.value,
  };
}

function readNote(entity: NexusEntityUnion<'note'>): RawNote {
  const collectionTarget = entity.fields.collection.value;
  return {
    id: entity.id,
    collectionEntityId: collectionTarget.entityId,
    positionTicks: entity.fields.positionTicks.value,
    durationTicks: entity.fields.durationTicks.value,
    pitch: entity.fields.pitch.value,
    velocity: entity.fields.velocity.value,
  };
}

function collectEntityLabels(query: EntityQuery): RawEntityLabels {
  const labels: RawEntityLabels = {};
  for (const entity of query.get()) {
    const fields = entity.fields as Record<string, { value?: unknown } | undefined>;
    const displayNameField = fields.displayName;
    if (
      displayNameField !== undefined &&
      typeof displayNameField === 'object' &&
      displayNameField !== null &&
      'value' in displayNameField &&
      typeof displayNameField.value === 'string'
    ) {
      const name = displayNameField.value.trim();
      if (name.length > 0) labels[entity.id] = name;
    }
  }
  return labels;
}

function readConfig(query: EntityQuery): RawConfig {
  const configEntity = query.ofTypes('config').getOne();
  if (configEntity === undefined) {
    return {
      tempoBpm: 125,
      signatureNumerator: 4,
      signatureDenominator: 4,
      durationTicks: 1_966_080,
    };
  }
  const f = configEntity.fields;
  return {
    tempoBpm: f.tempoBpm.value,
    signatureNumerator: f.signatureNumerator.value,
    signatureDenominator: f.signatureDenominator.value,
    durationTicks: f.durationTicks.value,
  };
}

/**
 * Query the opened Nexus document once and extract serializable arrangement rows.
 */
export function extractRawArrangementEntities(
  query: EntityQuery,
  source: ArrangementSnapshotSource
): RawArrangementEntities {
  return {
    config: readConfig(query),
    noteTracks: query.ofTypes('noteTrack').get().map((e) => readTrackRow(e)),
    audioTracks: query.ofTypes('audioTrack').get().map((e) => readTrackRow(e)),
    patternTracks: query.ofTypes('patternTrack').get().map((e) => readTrackRow(e)),
    noteRegions: query.ofTypes('noteRegion').get().map((e) => readNoteRegion(e)),
    audioRegions: query.ofTypes('audioRegion').get().map((e) => readAudioRegion(e)),
    patternRegions: query.ofTypes('patternRegion').get().map((e) => readPatternRegion(e)),
    notes: query.ofTypes('note').get().map((e) => readNote(e)),
    entityLabels: collectEntityLabels(query),
    source,
  };
}
