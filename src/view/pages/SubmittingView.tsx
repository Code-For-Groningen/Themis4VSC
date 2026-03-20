import * as React from "react";
import { useEffect, useState } from "react";
import { CourseNode, PinnedItem } from "../../protocol/protocol";
import CourseTree from "../components/CourseTree";
import useThemisClient from "../hooks/useThemisClient";
import { Pin, PinOff, Star, FolderOpen, FileCode, ChevronLeft } from "lucide-react";

function SubmittingView(props: {
    onSelectAssignment: (node: CourseNode) => void;
    browsePath: string | null;
    browseTitle: string;
    onBrowseChange: (path: string | null, title: string) => void;
}) {
    const { browsePath, browseTitle, onBrowseChange } = props;
    const client = useThemisClient();
    const [rootNodes, setRootNodes] = useState<CourseNode[] | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
    const [browseNodes, setBrowseNodes] = useState<CourseNode[] | undefined>(undefined);
    const [browseLoading, setBrowseLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            client.getNavigation("/"),
            client.getPinnedItems(),
        ]).then(([nodes, pinned]) => {
            setRootNodes(nodes);
            setPinnedItems(pinned);
            setLoading(false);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load children when browsing into a folder
    useEffect(() => {
        if (browsePath) {
            setBrowseLoading(true);
            client.getNavigation(browsePath).then(nodes => {
                setBrowseNodes(nodes);
                setBrowseLoading(false);
            });
        } else {
            setBrowseNodes(undefined);
        }
    }, [browsePath]); // eslint-disable-line react-hooks/exhaustive-deps

    const pinnedPaths = pinnedItems.map(p => p.path);

    const handleTogglePin = async (node: CourseNode) => {
        const isPinned = pinnedPaths.includes(node.path);
        const updated = await client.pinItem(node.path, node.title, node.submittable, !isPinned);
        setPinnedItems(updated);
    };

    const handlePinnedItemClick = (item: PinnedItem) => {
        if (item.submittable) {
            props.onSelectAssignment({
                title: item.title,
                path: item.path,
                submittable: true,
                icon: "ass-submitable",
            });
        } else {
            onBrowseChange(item.path, item.title);
        }
    };

    const handleBrowse = (node: CourseNode) => {
        onBrowseChange(node.path, node.title);
    };

    const handleDownloadTCs = (node: CourseNode) => {
        client.downloadInputs(node.path);
    };

    if (loading) {
        return <div className="loading">Loading courses...</div>;
    }

    // Browsing into a folder
    if (browsePath) {
        return <div>
            <button className="browse-back" onClick={() => onBrowseChange(null, "")}>
                <ChevronLeft size={14} />
                <span>{browseTitle}</span>
            </button>
            {browseLoading && <div className="loading">Loading...</div>}
            {browseNodes && browseNodes.map(node =>
                <CourseTree
                    key={node.path}
                    node={node}
                    onSelectAssignment={props.onSelectAssignment}
                    onBrowse={handleBrowse}
                    layer={0}
                    pinnedPaths={pinnedPaths}
                    onTogglePin={handleTogglePin}
                    onDownloadTCs={handleDownloadTCs}
                />
            )}
        </div>;
    }

    return <div>
        {/* Pinned Section */}
        {pinnedItems.length > 0 && (
            <div className="section">
                <div className="section-title"><Star size={11} /> Pinned</div>
                {pinnedItems.map(item =>
                    <div key={item.path} className="tree-node tree-node-pinned" onClick={() => handlePinnedItemClick(item)}>
                        <span className="tree-node-icon">
                            {item.submittable
                                ? <FileCode size={14} className="icon-accent" />
                                : <FolderOpen size={14} className="icon-muted" />
                            }
                        </span>
                        <span className="tree-node-label">{item.title}</span>
                        <span className="pin-toggle pinned" title="Unpin" onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin({ title: item.title, path: item.path, submittable: item.submittable, icon: "" });
                        }}><PinOff size={12} /></span>
                    </div>
                )}
            </div>
        )}

        {/* All Courses */}
        <div className="section">
            <div className="section-title">Courses</div>
            {(rootNodes || []).map(node =>
                <CourseTree
                    key={node.path}
                    node={node}
                    onSelectAssignment={props.onSelectAssignment}
                    onBrowse={handleBrowse}
                    layer={0}
                    pinnedPaths={pinnedPaths}
                    onTogglePin={handleTogglePin}
                    onDownloadTCs={handleDownloadTCs}
                />
            )}
        </div>
    </div>;
}

export default SubmittingView;