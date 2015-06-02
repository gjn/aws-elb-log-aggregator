This is to read AWS ELB logs and aggregate their statistics
on a per second basis.

Input is directory containing the ELB logs. The more files there
are, the longer it will take. Move the desired files to a
dedicated directory first.

Output is to console (which you can redirect to csv file easily)

Sample usage:

`node index.js path_to_logs`

Make sure you did `npm install` first.

This is a quick and dirty implementation. It contains swisstopo
specific code and output. It could be improved in many ways and
be driven by a configuration file.

Pull Requests welcome.
