import * as React from "react";
import { useState } from "react";
import { CourseNode } from "../../protocol/protocol";
import useThemisClient from "../hooks/useThemisClient";

function CourseTree(props: {
    node: CourseNode;
    onSelectAssignment: (node: CourseNode) => void;
    layer: number;
}) {
    const { node, onSelectAssignment, layer } = props;
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<CourseNode[] | undefined>(node.children);
    const [loading, setLoading] = useState(false);
    const client = useThemisClient();

    if (node.submittable) {
        return <div
            className="tree-node tree-node-submittable"
            style={{ paddingLeft: layer * 12 }}
            onClick={() => onSelectAssignment(node)}
        >
            <span className="tree-node-icon">&#9733;</span>
            <span className="tree-node-label">{node.title}</span>
        </div>;
    }

    const handleExpand = async () => {
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
            style={{ paddingLeft: layer * 12 }}
            onClick={handleExpand}
        >
            <span className="tree-node-icon">{expanded ? "\u25BC" : "\u25B6"}</span>
            <span className="tree-node-label">{node.title}</span>
        </div>
        {expanded && (
            <div className="tree-children">
                {loading
                    ? <div className="tree-loading">Loading...</div>
                    : (children || []).map(child =>
                        <CourseTree
                            key={child.path}
                            node={child}
                            onSelectAssignment={onSelectAssignment}
                            layer={layer + 1}
                        />
                    )
                }
            </div>
        )}
    </div>;
}

export default CourseTree;