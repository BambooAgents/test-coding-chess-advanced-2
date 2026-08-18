import { NavLink, Outlet } from 'react-router-dom'
import styled from 'styled-components'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/play', label: 'Play', end: false },
  { to: '/analyze', label: 'Analyze', end: false },
  { to: '/puzzles', label: 'Puzzles', end: false },
  { to: '/weaknesses', label: 'My Weaknesses', end: false },
]

const Header = styled.header`
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: var(--sp-4) var(--sp-8);
  display: flex;
  align-items: center;
  gap: var(--sp-8);
`

const Logo = styled.span`
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.025em;
  white-space: nowrap;
`

const Nav = styled.nav`
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
`

const NavItem = styled(NavLink)`
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-muted);
  transition: all 0.15s ease;

  &:hover {
    color: var(--text);
    background: var(--bg-elevated);
  }

  &.active {
    color: var(--accent);
    background: var(--accent-light);
  }
`

const Main = styled.main`
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--sp-8);
`

export function AppShell() {
  return (
    <>
      <Header>
        <Logo>♟ Chess Advanced</Logo>
        <Nav>
          {navItems.map((item) => (
            <NavItem key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavItem>
          ))}
        </Nav>
      </Header>
      <Main>
        <Outlet />
      </Main>
    </>
  )
}
