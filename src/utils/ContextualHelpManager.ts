/**
 * Contextual Help Manager
 * Loads and manages contextual help content from JSON
 */

import type { NodeSpec } from '../types/nodeSpec';

/** Node in a Setup example mini graph (id = graph-local id; type = node type id e.g. uv-coordinates, noise). */
export interface SetupExampleGraphNode {
  id: string;
  type: string;
}

/** Connection in a Setup example mini graph; from/to refer to node id in the same graph. */
export interface SetupExampleGraphConnection {
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
}

/** Structured Setup example graph: nodes and connections for MiniGraph. */
export interface SetupExampleGraph {
  nodes: SetupExampleGraphNode[];
  connections: SetupExampleGraphConnection[];
}

export interface HelpPort {
  name: string;
  /** Human-readable label for UI (e.g. "UV", "Result"); when set, shown instead of name in help and headers. */
  label?: string;
  type: string;
  description: string;
  /** For input ports: node/type IDs that can feed this input ("node:constant-float", "type:float"). */
  suggestedSources?: string[];
  /** For output ports: node IDs this output can connect to ("node:add", "node:multiply"). */
  suggestedTargets?: string[];
}

export interface HelpParameter {
  name: string;
  /** What the parameter does; include how it affects the result so the visual impact is clear. */
  description: string;
}

export interface HelpContent {
  title: string;
  titleType: 'type' | 'node' | 'parameter' | 'category' | string;
  category?: string;
  /** Short tagline (optional). */
  tagline?: string;
  description: string;
  /** Input ports: name, type, and user-facing description for each input */
  inputs?: HelpPort[];
  /** Output ports: name, type, and user-facing description for each output */
  outputs?: HelpPort[];
  /** Slider/control parameters: what each does and how it affects the visual. One entry per parameter. */
  parameters?: HelpParameter[];
  /** Optional structured graph (nodes + connections) for Setup example mini-graph visualization. */
  setupExampleGraph?: SetupExampleGraph;
  examples?: string[];
  relatedItems?: string[]; // Format: "type:float" or "node:constant-float"
  icon?: string;
  /** Optional advanced/technical note (e.g. for experts). */
  advanced?: string;
}

export interface HelpData {
  helpItems: Record<string, HelpContent>;
  categories: Record<string, {
    icon?: string;
    color?: string;
  }>;
}

let helpData: HelpData | null = null;

/**
 * Load help data from JSON files
 */
export async function loadHelpData(): Promise<HelpData> {
  if (helpData) {
    return helpData;
  }

  try {
    // Load both contextual-help.json and node-documentation.json
    const helpModules = import.meta.glob(['/src/data/contextual-help.json', '/src/data/node-documentation.json'], { eager: false });
    const contextualHelpPath = '/src/data/contextual-help.json';
    const nodeDocPath = '/src/data/node-documentation.json';
    
    const mergedData: HelpData = {
      helpItems: {},
      categories: {}
    };

    // Load contextual help data
    if (contextualHelpPath in helpModules) {
      const contextualModule = await helpModules[contextualHelpPath]();
      const contextualData = (contextualModule as { default: HelpData }).default;
      Object.assign(mergedData.helpItems, contextualData.helpItems);
      Object.assign(mergedData.categories, contextualData.categories);
    }

    // Load node documentation data
    if (nodeDocPath in helpModules) {
      const nodeDocModule = await helpModules[nodeDocPath]();
      const nodeDocData = (nodeDocModule as { default: HelpData }).default;
      Object.assign(mergedData.helpItems, nodeDocData.helpItems);
      // Merge categories if they exist
      if (nodeDocData.categories) {
        Object.assign(mergedData.categories, nodeDocData.categories);
      }
    }

    helpData = mergedData;
    return helpData;
  } catch (error) {
    console.error('Failed to load help data:', error);
    // Return empty data structure as fallback
    return {
      helpItems: {},
      categories: {}
    };
  }
}

/**
 * Get help content by ID
 * @param helpId Format: "type:float", "node:constant-float", etc.
 */
export async function getHelpContent(helpId: string): Promise<HelpContent | null> {
  const data = await loadHelpData();
  return data.helpItems[helpId] || null;
}

/**
 * Get related node specs for a help item
 * @param helpId Help item ID
 * @param nodeSpecs Map of all available node specs
 */
export function getRelatedNodeSpecs(
  _helpId: string,
  _nodeSpecs: Map<string, NodeSpec>
): NodeSpec[] {
  // This will be called after help content is loaded
  // For now, return empty array - will be populated by caller
  return [];
}

/**
 * Resolve related items from help content
 * @param relatedItems Array of related item IDs
 * @param nodeSpecs Map of all available node specs
 */
export function resolveRelatedItems(
  relatedItems: string[],
  nodeSpecs: Map<string, NodeSpec>
): {
  nodes: NodeSpec[];
  types: string[];
} {
  const nodes: NodeSpec[] = [];
  const types: string[] = [];

  for (const itemId of relatedItems) {
    if (itemId.startsWith('node:')) {
      const nodeId = itemId.substring(5); // Remove "node:" prefix
      const spec = nodeSpecs.get(nodeId);
      if (spec) {
        nodes.push(spec);
      }
    } else if (itemId.startsWith('type:')) {
      const type = itemId.substring(5); // Remove "type:" prefix
      types.push(type);
    }
  }

  return { nodes, types };
}

/**
 * Find all nodes that use a specific type
 * @param type Port type to search for
 * @param nodeSpecs Map of all available node specs
 */
export function findNodesUsingType(
  type: string,
  nodeSpecs: Map<string, NodeSpec>
): NodeSpec[] {
  const matchingNodes: NodeSpec[] = [];

  for (const spec of nodeSpecs.values()) {
    // Check inputs
    const hasInputType = spec.inputs.some(port => port.type === type);
    // Check outputs
    const hasOutputType = spec.outputs.some(port => port.type === type);

    if (hasInputType || hasOutputType) {
      matchingNodes.push(spec);
    }
  }

  return matchingNodes;
}
