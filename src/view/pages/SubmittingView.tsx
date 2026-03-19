import * as React from "react";
import { useEffect, useState } from "react";
import { CourseNode } from "../../protocol/protocol";
import CourseTree from "../components/CourseTree";
import useThemisClient from "../hooks/useThemisClient";

function SubmittingView(props: { onSelectAssignment: (node: CourseNode) => void }) {
    const client = useThemisClient();
    const [rootNodes, setRootNodes] = useState<CourseNode[] | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.getNavigation("/").then(nodes => {
            setRootNodes(nodes);
            setLoading(false);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="loading">Loading courses...</div>;
    }

    return <div>
        <div className="section-title">Courses</div>
        {(rootNodes || []).map(node =>
            <CourseTree
                key={node.path}
                node={node}
                onSelectAssignment={props.onSelectAssignment}
                layer={0}
            />
        )}
    </div>;
}

export default SubmittingView;