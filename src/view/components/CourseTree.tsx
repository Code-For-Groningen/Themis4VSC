import * as React from "react";
import { useState } from "react";
import { Course } from "../../protocol/protocol";

function CourseTree(props: { course: Course, setSelectedAssignment: (course: Course) => void, layer: number }) {
    let [expanded, setExpanded] = useState(false);

    let { course, setSelectedAssignment, layer } = props;

    let style: React.CSSProperties = {
        marginLeft: layer * 7 + "px",
        cursor: "pointer",
        paddingRight: "5px",
        userSelect: "none"
    };

    if (course.courses.length === 0) {
        // We are dealing with an assignment
        return <>
            <div onClick={(event) => {
                event.stopPropagation();
                setSelectedAssignment(course);
            }} style={style}>
                {/** A small star and the course */}
                {"★"} {course.title}
            </div>
        </>;
    } else {
        // We are dealing with a course (with subcourses)
        return <>
            <div onClick={(event) => {
                event.stopPropagation();
                setExpanded(!expanded);
            }} style={style}>
                {expanded ? "▼" : "▶"}
                {course.title}
                {
                    expanded && course.courses.map((course) =>
                        <CourseTree key={course.path} course={course} setSelectedAssignment={setSelectedAssignment} layer={layer + 1} />
                    )
                }
            </div>
        </>;
    }
}

export default CourseTree;