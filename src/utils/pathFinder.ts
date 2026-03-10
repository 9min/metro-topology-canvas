import type { StationLink } from "@/types/station";

/** 역 ID → 인접 역 ID 배열 (무방향 그래프) */
export type StationGraph = Map<string, string[]>;

/** 그래프에 간선을 양방향으로 추가한다 */
function addEdge(graph: StationGraph, a: string, b: string): void {
	const aNeighbors = graph.get(a);
	if (aNeighbors !== undefined) {
		if (!aNeighbors.includes(b)) aNeighbors.push(b);
	} else {
		graph.set(a, [b]);
	}
}

/** links.json에서 무방향 그래프를 구축한다 */
export function buildStationGraph(links: StationLink[]): StationGraph {
	const graph: StationGraph = new Map();
	for (const link of links) {
		addEdge(graph, link.source, link.target);
		addEdge(graph, link.target, link.source);
	}
	return graph;
}

/** parent 맵을 역추적하여 fromId→toId 경로를 반환한다 */
function reconstructPath(parent: Map<string, string>, fromId: string, toId: string): string[] {
	const path: string[] = [toId];
	let node = toId;
	while (node !== fromId) {
		const p = parent.get(node);
		if (p === undefined) return [];
		path.push(p);
		node = p;
	}
	path.reverse();
	return path;
}

/** BFS로 fromId→toId 최단 경로를 반환한다. [fromId, ...중간역, toId] */
export function findStationPath(graph: StationGraph, fromId: string, toId: string): string[] {
	if (fromId === toId) return [fromId];

	const visited = new Set<string>([fromId]);
	const parent = new Map<string, string>();
	const queue: string[] = [fromId];

	while (queue.length > 0) {
		const current = queue.shift() as string;
		const neighbors = graph.get(current);
		if (neighbors === undefined) continue;

		for (const neighbor of neighbors) {
			if (visited.has(neighbor)) continue;
			visited.add(neighbor);
			parent.set(neighbor, current);
			if (neighbor === toId) return reconstructPath(parent, fromId, toId);
			queue.push(neighbor);
		}
	}

	return [];
}
