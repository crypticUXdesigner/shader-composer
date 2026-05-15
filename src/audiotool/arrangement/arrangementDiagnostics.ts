import type { ArrangementSnapshot } from './types';
import type { RawArrangementEntities } from './rawEntities';

export type ArrangementNotesBakeSummary = {
  notes: unknown[];
  pitchMin: number;
  pitchMax: number;
};

const LOG_PREFIX = '[arrangement]';

export type ArrangementLinkageReport = {
  rawNoteEntities: number;
  enabledNoteRegions: number;
  enabledRegionCollectionIds: string[];
  /** Collections referenced by more than one enabled note region (shared MIDI clips). */
  sharedCollectionCount: number;
  uniqueNoteCollectionIds: string[];
  matchedNotes: number;
  orphanNotes: number;
  regionCollectionsWithNoNotes: number;
  snapshotNoteCount: number;
  /** Snapshot notes / matched raw entities (loop expansion factor; 1 when no loops). */
  noteExpansionFactor: number;
  noteRegionCount: number;
  audioRegionCount: number;
  patternRegionCount: number;
};

/** Compare raw Nexus rows vs normalized snapshot note linkage. */
export function buildArrangementLinkageReport(
  raw: RawArrangementEntities,
  snapshot: ArrangementSnapshot
): ArrangementLinkageReport {
  const enabledRegions = raw.noteRegions.filter((r) => r.region.isEnabled);
  const collectionUseCount = new Map<string, number>();
  for (const row of enabledRegions) {
    const id = row.collectionEntityId;
    collectionUseCount.set(id, (collectionUseCount.get(id) ?? 0) + 1);
  }
  const sharedCollectionCount = [...collectionUseCount.values()].filter((n) => n > 1).length;
  const regionCollectionIds = new Set(collectionUseCount.keys());
  const noteCollectionIds = new Set(raw.notes.map((n) => n.collectionEntityId));

  let matchedNotes = 0;
  let orphanNotes = 0;
  for (const note of raw.notes) {
    if (regionCollectionIds.has(note.collectionEntityId)) {
      matchedNotes += 1;
    } else {
      orphanNotes += 1;
    }
  }

  let regionCollectionsWithNoNotes = 0;
  for (const id of regionCollectionIds) {
    if (!noteCollectionIds.has(id)) {
      regionCollectionsWithNoNotes += 1;
    }
  }

  const snapshotNoteCount = snapshot.notes?.length ?? 0;
  const noteExpansionFactor =
    matchedNotes > 0 ? snapshotNoteCount / matchedNotes : snapshotNoteCount > 0 ? Infinity : 1;

  return {
    rawNoteEntities: raw.notes.length,
    enabledNoteRegions: enabledRegions.length,
    sharedCollectionCount,
    enabledRegionCollectionIds: [...regionCollectionIds],
    uniqueNoteCollectionIds: [...noteCollectionIds],
    matchedNotes,
    orphanNotes,
    regionCollectionsWithNoNotes,
    snapshotNoteCount,
    noteExpansionFactor,
    noteRegionCount: snapshot.regions.filter((r) => r.kind === 'note').length,
    audioRegionCount: snapshot.regions.filter((r) => r.kind === 'audio').length,
    patternRegionCount: snapshot.regions.filter((r) => r.kind === 'pattern').length,
  };
}

export function logArrangementImportDiagnostics(
  raw: RawArrangementEntities,
  snapshot: ArrangementSnapshot
): ArrangementLinkageReport {
  const report = buildArrangementLinkageReport(raw, snapshot);
  const { source } = snapshot;

  console.info(`${LOG_PREFIX} import`, {
    track: source.trackName,
    project: source.projectName,
    commitIndex: source.commitIndex,
    regions: snapshot.regions.length,
    notesInSnapshot: report.snapshotNoteCount,
    noteExpansionFactor: report.noteExpansionFactor,
    rawNoteEntities: report.rawNoteEntities,
    enabledNoteRegions: report.enabledNoteRegions,
    sharedCollections: report.sharedCollectionCount,
    matchedRawNotes: report.matchedNotes,
    orphanRawNotes: report.orphanNotes,
    regionCollectionsWithNoNotes: report.regionCollectionsWithNoNotes,
    noteRegions: report.noteRegionCount,
    audioRegions: report.audioRegionCount,
    patternRegions: report.patternRegionCount,
  });

  if (report.rawNoteEntities > 0 && report.snapshotNoteCount === 0) {
    console.warn(
      `${LOG_PREFIX} import: Nexus returned ${report.rawNoteEntities} note entities but snapshot has 0 notes — collection ids on notes may not match enabled noteRegion collections.`,
      {
        sampleNoteCollectionIds: report.uniqueNoteCollectionIds.slice(0, 8),
        sampleRegionCollectionIds: report.enabledRegionCollectionIds.slice(0, 8),
        orphanNotes: report.orphanNotes,
      }
    );
  } else if (
    report.enabledNoteRegions > 0 &&
    report.snapshotNoteCount === 0 &&
    report.rawNoteEntities === 0
  ) {
    console.warn(
      `${LOG_PREFIX} import: ${report.enabledNoteRegions} enabled note region(s) but Nexus query returned 0 note entities. MIDI may live only inside pattern devices (not supported for arrangement-notes yet).`
    );
  }

  if (import.meta.env.DEV) {
    (globalThis as { __shaderComposerArrangement?: unknown }).__shaderComposerArrangement = {
      snapshot,
      raw,
      report,
    };
    console.info(
      `${LOG_PREFIX} dev: inspect window.__shaderComposerArrangement (snapshot, raw, report)`
    );
  }

  return report;
}

export function logArrangementNotesBakeDiagnostics(
  nodeId: string,
  snapshot: ArrangementSnapshot | undefined,
  packed: ArrangementNotesBakeSummary,
  trackFilterMode: number,
  trackFilterList: string
): void {
  const snapshotNotes = snapshot?.notes?.length ?? 0;
  const baked = packed.notes.length;

  console.info(`${LOG_PREFIX} compile bake (arrangement-notes)`, {
    nodeId,
    snapshotNotes,
    bakedNotes: baked,
    pitchMin: packed.pitchMin,
    pitchMax: packed.pitchMax,
    trackFilterMode,
    trackFilterList: trackFilterList || '(empty)',
  });

  if (snapshotNotes > 0 && baked === 0) {
    console.warn(
      `${LOG_PREFIX} compile: snapshot has ${snapshotNotes} notes but this node baked 0 — check Tracks filter (mode ${trackFilterMode}) or re-import after changing filter.`
    );
  } else if (baked > 0) {
    console.info(
      `${LOG_PREFIX} compile: shader will use ARR_NOTE_COUNT for this node = ${baked} (search compiled shader for "ARR_NOTE_COUNT_" + node id suffix)`
    );
  }
}
