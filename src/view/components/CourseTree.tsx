import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { CourseNode, PinnedItem } from "../../protocol/protocol";
import useThemisClient from "../hooks/useThemisClient";
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Pin, PinOff, Download } from "lucide-react";

function CourseTree(props: {
    node: CourseNode;
    onSelectAssignment: (node: CourseNode) => void;
    onBrowse: (node: CourseNode) => void;
    layer: number;
    pinnedPaths: string[];
    onTogglePin: (node: CourseNode) => void;
    onDownloadTCs?: (node: CourseNode) => void;
}) {
    const { node, onSelectAssignment, onBrowse, layer, pinnedPaths, onTogglePin, onDownloadTCs } = props;
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<CourseNode[] | undefined>(node.children);
    const [loading, setLoading] = useState(false);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
    const ctxMenuRef = useRef<HTMLDivElement>(null);
    const client = useThemisClient();

    const isPinned = pinnedPaths.includes(node.path);

    // Close context menu when clicking outside
    useEffect(() => {
        if (!ctxMenu) { return; }
        const close = (e: MouseEvent) => {
            if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
                setCtxMenu(null);
            }
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [ctxMenu]);

    if (node.submittable) {
        return <React.Fragment>
            <div
                className="tree-node tree-node-submittable"
                style={{ paddingLeft: layer * 16 }}
                onClick={() => onSelectAssignment(node)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
            >
                <span className="tree-node-icon"><FileCode size={14} className="icon-accent" /></span>
                <span className="tree-node-label">{node.title}</span>
                <span
                    className={`pin-toggle ${isPinned ? "pinned" : ""}`}
                    title={isPinned ? "Unpin" : "Pin"}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(node); }}
                >{isPinned ? <PinOff size={12} /> : <Pin size={12} />}</span>
            </div>
            {ctxMenu && (
                <div
                    ref={ctxMenuRef}
                    className="tree-context-menu"
                    style={{ top: ctxMenu.y, left: ctxMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="tree-context-item"
                        onClick={() => { setCtxMenu(null); onDownloadTCs?.(node); }}
                    >
                        <Download size={12} /> Download Test Cases
                    </button>
                </div>
            )}
        </React.Fragment>;
    }

    const handleExpandChevron = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (expanded) {
            setExpanded(false);
            return;
        }
        setExpanded(true);
        if (!children) {
            setLoading(true);
            const fetched = await client.getNavigation(node.path);
            setChildren(fetched);
            setLoading(false);
        }
    };

    return <div>
        <div
            className="tree-node"
            style={{ paddingLeft: layer * 16 }}
            onClick={() => onBrowse(node)}
        >
            {/* Chevron toggles inline expand; clicking it does NOT browse */}
            <span
                className="tree-node-icon tree-node-chevron"
                onClick={handleExpandChevron}
                title={expanded ? "Collapse" : "Expand inline"}
            >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="tree-node-icon" style={{ marginRight: 2 }}>
                {expanded ? <FolderOpen size={14} className="icon-folder" /> : <Folder size={14} className="icon-folder" />}
            </span>
            <span className="tree-node-label">{node.title}</span>
            <span
                className={`pin-toggle ${isPinned ? "pinned" : ""}`}
                title={isPinned ? "Unpin" : "Pin"}
                onClick={(e) => { e.stopPropagation(); onTogglePin(node); }}
            >{isPinned ? <PinOff size={12} /> : <Pin size={12} />}</span>
        </div>
        {expanded && (
            <div>
                {loading
                    ? <div className="tree-loading" style={{ paddingLeft: (layer + 1) * 16 }}>Loading...</div>
                    : (children || []).map(child =>
                        <CourseTree
                            key={child.path}
                            node={child}
                            onSelectAssignment={onSelectAssignment}
                            onBrowse={onBrowse}
                            layer={layer + 1}
                            pinnedPaths={pinnedPaths}
                            onTogglePin={onTogglePin}
                            onDownloadTCs={onDownloadTCs}
                        />
                    )
                }
            </div>
        )}
    </div>;
}

export default CourseTree;