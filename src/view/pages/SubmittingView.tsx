import * as React from "react";
import { useEffect, useState } from "react";
import { Course } from "../../protocol/protocol";
import CourseTree from "../components/CourseTree";
import useThemisClient from "../hooks/useThemisClient";


function CourseList() {
    let client = useThemisClient();

    let [courses, setCourses] = useState<Course>(undefined);
    let [loading, setLoading] = useState(true);

    function refreshCourseList() {
        setTimeout(() => {
            client.getRootCourse().then((courses) => {
                setCourses(courses);
                setLoading(false);
            });
        }, 1000);
    }


    useEffect(refreshCourseList, []);

    return <>
        {loading ?
            <div> Please wait! We are indexing courses. (This may take a while) </div>
            :
            <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                        Course List
                    </div>
                    <div>
                        <button onClick={async () => {
                            // Invalidate state to prevent double submission
                            setLoading(true);
                            setCourses(undefined);

                            // Clear cache
                            await client.refreshCourses();

                            // Refresh
                            refreshCourseList();
                        }}>
                            Refresh
                        </button>
                    </div>
                </div>
                <CourseTree course={courses} setSelectedAssignment={() => { }} layer={0} />
            </>
        }
    </>;
}

function SubmittingView() {
    let client = useThemisClient();

    let [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

    return <>
        <CourseList />
    </>;
}

export default SubmittingView;