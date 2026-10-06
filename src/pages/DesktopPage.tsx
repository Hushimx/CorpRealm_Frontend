import { ComputerDesktop } from '../components/ComputerDesktop'
import { useOfficePeople } from '../net/people'
import { OFFICE_BOARDS } from '../office/boards'

export function DesktopPage() {
  const people = useOfficePeople('hq')
  return (
    <div className="absolute inset-0">
      <ComputerDesktop
        page
        officeId="hq"
        boards={OFFICE_BOARDS.map((item) => ({ id: item.id, title: item.title }))}
        people={people}
      />
    </div>
  )
}
